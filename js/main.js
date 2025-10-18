// Letterboxd Stats Dashboard - Main Application
// Arquitetura modular em IIFE

(function() {
    'use strict';

    // Helper to resolve CSS variables to actual values for JS libraries (e.g., Google Charts)
    const CssVars = {
        get: (name, fallback = '') => {
            try {
                const value = getComputedStyle(document.documentElement).getPropertyValue(name);
                const trimmed = value ? value.trim() : '';
                return trimmed || fallback;
            } catch (e) {
                return fallback;
            }
        }
    };

    // ========================================
    // STATE MANAGEMENT MODULE
    // ========================================
    const State = (function() {
        let state = {
            tmdbApiKey: API_CONFIG.TMDB_API_KEY,
            movies: [],
            directors: new Map(),
            actors: new Map(),
            genres: new Map(),
            currentView: 'dashboard',
            selectedMovie: null,
            selectedPerson: null,
            selectedPersonType: 'directors'
        };

        return {
            // Getters
            get: (key) => state[key],
            getAll: () => ({ ...state }),

            // Setters
            set: (key, value) => {
                state[key] = value;
            },

            // Update multiple values
            update: (updates) => {
                Object.assign(state, updates);
            },

            // Clear state
            clear: () => {
                state = {
                    tmdbApiKey: null,
                    movies: [],
                    directors: new Map(),
                    actors: new Map(),
                    genres: new Map(),
                    currentView: 'dashboard',
                    selectedMovie: null,
                    selectedPerson: null,
                    selectedPersonType: 'directors'
                };
            }
        };
    })();

    // ========================================
    // UI MANAGEMENT MODULE
    // ========================================
    const UI = (function() {
        const originalModalBodyHTML = `
            <div class=\"modal-chart-container\">
                <canvas id=\"modal-chart\"></canvas>
            </div>
            <div class=\"modal-details-container\">
                <h3>Detalhes</h3>
                <div id=\"modal-chart-details\"></div>
            </div>
        `;

        return {
            // Show/hide containers
            showSetup: () => {
                document.getElementById('setup-container').classList.remove('hidden');
                document.getElementById('main-app').classList.add('hidden');
            },

            showMainApp: () => {
                document.getElementById('setup-container').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
            },

            // Navigation
            showView: (viewName) => {
                // Hide all pages
                document.querySelectorAll('.page').forEach(page => {
                    page.classList.remove('active');
                });

                // Show selected page
                const targetPage = document.getElementById(`${viewName}-page`) || 
                                 document.getElementById(viewName);
                if (targetPage) {
                    targetPage.classList.add('active');
                }

                // Update navigation tabs
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                const activeTab = document.querySelector(`[data-view=\"${viewName}\"]`);
                if (activeTab) {
                    activeTab.classList.add('active');
                }

                State.set('currentView', viewName);
            },

            // Modal management
            showModal: (title, chartType, chartData) => {
                const modal = document.getElementById('chart-modal-view');
                const modalBody = modal.querySelector('.modal-body');
                modalBody.innerHTML = originalModalBodyHTML;

                const titleEl = document.getElementById('modal-chart-title');
                const detailsContainer = document.getElementById('modal-chart-details');

                titleEl.textContent = title;
                modal.classList.add('show');

                // Create chart
                const canvas = document.getElementById('modal-chart');
                if (window.modalChart) {
                    window.modalChart.destroy();
                }
                const ctx = canvas.getContext('2d');
                window.modalChart = new Chart(ctx, chartData);

                // Populate details
                const detailsHtml = Data.getChartDetails(chartType);
                detailsContainer.innerHTML = detailsHtml;
            },

            // Show summary modal (special case for summary chart)
            showSummaryModal: (title, content) => {
                const modal = document.getElementById('chart-modal-view');
                const titleEl = document.getElementById('modal-chart-title');
                const modalBody = modal.querySelector('.modal-body');

                titleEl.textContent = title;

                // Clear any existing chart and show summary content in a scrollable container
                modalBody.innerHTML = `<div class=\"summary-details-grid\" style=\"flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; padding: 30px; overflow-y: auto; align-content: start;\">${content}</div>`;
                modal.classList.add('show');
            },

            hideModal: () => {
                const modal = document.getElementById('chart-modal-view');
                modal.classList.remove('show');
            },

            showToast: (message, type = 'error', duration = 5000) => {
                const container = document.getElementById('toast-container');
                if (!container) return;

                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;

                container.appendChild(toast);

                // Fade out and remove
                setTimeout(() => {
                    toast.classList.add('fade-out');
                    toast.addEventListener('animationend', () => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    });
                }, duration - 500);
            },

            // Setup form
            setupForm: () => {
                const form = document.getElementById('setup-form');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const fileInput = document.getElementById('csv-file');
                    
                    if (!fileInput.files[0]) {
                        UI.showToast('Por favor, selecione um ficheiro CSV.');
                        return;
                    }

                    try {
                        await Data.processCSV(fileInput.files[0]);
                        UI.showMainApp();
                        App.initialize();
                    } catch (error) {
                        UI.showToast('Erro ao processar o ficheiro: ' + error.message);
                    }
                });
            },

            // Navigation setup
            setupNavigation: () => {
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        const view = tab.getAttribute('data-view');
                        UI.showView(view);
                        
                        if (view === 'my-movies') {
                            UI.renderMoviesList();
                        } else if (view === 'people-explorer') {
                            UI.renderPeopleList();
                        }
                    });
                });
            },

            // Chart containers setup
            setupChartContainers: () => {
                document.querySelectorAll('.chart-container').forEach(container => {
                    container.addEventListener('click', () => {
                        const chartType = container.getAttribute('data-chart');
                        const title = container.querySelector('h3').textContent;
                        
                        // Special handling for summary chart (not a Chart.js chart)
                        if (chartType === 'summary') {
                            const summaryDetails = Data.getChartDetails('summary');
                            UI.showSummaryModal(title, summaryDetails);
                            return;
                        }
                        
                        // Get chart data from Charts module
                        const chartData = Charts.getChartData(chartType);
                        if (chartData) {
                            UI.showModal(title, chartType, chartData);
                        } else {
                            console.warn(`No chart data found for type: ${chartType}`);
                        }
                    });
                });
            },

            // Modal close setup
            setupModalClose: () => {
                document.querySelector('.modal-close').addEventListener('click', UI.hideModal);
                document.getElementById('chart-modal-view').addEventListener('click', (e) => {
                    if (e.target.id === 'chart-modal-view') {
                        UI.hideModal();
                    }
                });
            },

            // Render movies list
            renderMoviesList: () => {
                const movies = State.get('movies');
                const container = document.getElementById('movies-list');
                
                container.innerHTML = movies.map((movie, index) => `
                    <div class=\"movie-item\" data-index=\"${index}\" style=\"animation-delay: ${index * 50}ms\">
                        <h4>${movie.title}</h4>
                        <div class=\"meta\">${movie.year} • ${movie.rating} • ${movie.director}</div>
                    </div>
                `).join('');

                // Add click listeners
                container.querySelectorAll('.movie-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const index = parseInt(item.getAttribute('data-index'));
                        const movie = movies[index];
                        
                        // Update selection
                        container.querySelectorAll('.movie-item').forEach(el => 
                            el.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        // Show movie details
                        UI.renderMovieDetails(movie);
                    });
                });
            },

            // Render movie details
            renderMovieDetails: (movie) => {
                const container = document.getElementById('movie-details');
                const posterUrl = movie.posterPath ? 
                    `https://image.tmdb.org/t/p/w300${movie.posterPath}` : null;
                
                container.innerHTML = `
                    <div class=\"movie-detail\">
                        <div class=\"movie-header\">
                            ${posterUrl ? `<img src=\"${posterUrl}\" alt=\"${movie.title}\" class=\"movie-poster\">` : ''}
                            <div class=\"movie-info\">
                                <h3>${movie.title}</h3>
                                <p class=\"movie-year\">(${movie.year})</p>
                                <p class=\"movie-rating\">Sua nota: ${movie.rating}</p>
                            </div>
                        </div>
                        
                        <div class=\"movie-meta\">
                            ${movie.director ? `<p><strong>Diretor:</strong> ${movie.director}</p>` : ''}
                            ${movie.runtime > 0 ? `<p><strong>Duração:</strong> ${movie.runtime} min</p>` : ''}
                            ${movie.genres.length > 0 ? `<p><strong>Gêneros:</strong> ${movie.genres.join(', ')}</p>` : ''}
                            ${movie.cast.length > 0 ? `<p><strong>Elenco:</strong> ${movie.cast.slice(0, 5).join(', ')}${movie.cast.length > 5 ? '...' : ''}</p>` : ''}
                            <p><strong>Assistido em:</strong> ${movie.dateWatched}</p>
                            ${movie.overview ? `<div class=\"movie-overview\"><strong>Sinopse:</strong><p>${movie.overview}</p></div>` : ''}
                        </div>
                    </div>
                `;
            },

            // Render people list
            renderPeopleList: () => {
                const type = State.get('selectedPersonType');
                const peopleMap = State.get(type);
                const container = document.getElementById('people-list');
                
                if (!peopleMap || peopleMap.size === 0) {
                    container.innerHTML = '<div class=\"placeholder\"><p>Nenhuma pessoa encontrada</p></div>';
                    return;
                }
                
                const people = Array.from(peopleMap.entries())
                    .sort((a, b) => b[1].count - a[1].count);
                
                container.innerHTML = people.map(([name, data], index) => `
                    <div class=\"person-item\" data-name=\"${name}\" style=\"animation-delay: ${index * 50}ms\">
                        <h4>${name}</h4>
                        <div class=\"meta\">${data.count} filmes • Nota média: ${data.averageRating.toFixed(1)}</div>
                    </div>
                `).join('');

                // Add click listeners
                container.querySelectorAll('.person-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const name = item.getAttribute('data-name');
                        
                        // Update selection
                        container.querySelectorAll('.person-item').forEach(el => 
                            el.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        // Show person details
                        UI.renderPersonDetails(name, peopleMap.get(name));
                    });
                });
            },

            // Render person details
            renderPersonDetails: (name, data) => {
                const container = document.getElementById('person-details');
                const personMovies = (data.movies || []).sort((a, b) => b.rating - a.rating);

                if (personMovies.length === 0) {
                    container.innerHTML = '<div class=\"placeholder\"><p>Nenhum filme encontrado para esta pessoa.</p></div>';
                    return;
                }

                const bestMovie = personMovies[0];
                const worstMovie = personMovies[personMovies.length - 1];

                // Calculate rating distribution
                const ratingDistribution = {};
                personMovies.forEach(movie => {
                    const rating = Math.floor(movie.rating);
                    ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
                });

                container.innerHTML = `
                    <div class=\"person-stats\">
                        <h3>${name}</h3>
                        
                        <div class=\"stats-cards\">
                            <div class=\"stat-card\">
                                <h4>Total de Filmes</h4>
                                <div class=\"value\">${data.count}</div>
                            </div>
                            <div class=\"stat-card\">
                                <h4>Nota Média</h4>
                                <div class=\"value\">${data.averageRating.toFixed(1)}</div>
                            </div>
                            <div class=\"stat-card\">
                                <h4>Primeiro Filme</h4>
                                <div class=\"value\">${data.firstMovie.year}</div>
                            </div>
                            <div class=\"stat-card\">
                                <h4>Último Filme</h4>
                                <div class=\"value\">${data.lastMovie.year}</div>
                            </div>
                        </div>

                        <div class=\"best-worst\">
                            <div class=\"best-worst-item\">
                                <h4>Melhor Filme</h4>
                                <p>${bestMovie.title} (${bestMovie.year})</p>
                                <p>${bestMovie.rating}</p>
                            </div>
                            <div class=\"best-worst-item\">
                                <h4>Pior Filme</h4>
                                <p>${worstMovie.title} (${worstMovie.year})</p>
                                <p>${worstMovie.rating}</p>
                            </div>
                        </div>

                        <div class=\"mini-chart\">
                            <h4>Distribuição de Notas</h4>
                            <canvas id=\"person-rating-chart\" width=\"300\" height=\"150\"></canvas>
                        </div>

                        <div class=\"filmography\">
                            <h4>Filmografia</h4>
                            ${personMovies.map(movie => `
                                <div class=\"film-item\">
                                    <div>
                                        <span class=\"title\">${movie.title}</span>
                                        <span class=\"year\">(${movie.year})</span>
                                    </div>
                                    <span class=\"rating\">${movie.rating}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;

                // Render mini chart
                const ctx = document.getElementById('person-rating-chart').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(ratingDistribution).map(r => r + ''),
                        datasets: [{
                            label: 'Quantidade',
                            data: Object.values(ratingDistribution),
                            backgroundColor: '#667eea',
                            borderColor: '#764ba2',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            }
                        }
                    }
                });
            },

            // Setup search functionality
            setupSearch: () => {
                // Movie search
                const movieSearch = document.getElementById('movie-search');
                if (movieSearch) {
                    movieSearch.addEventListener('input', (e) => {
                        const query = e.target.value.toLowerCase();
                        const movies = State.get('movies');
                        const filtered = movies.filter(movie => 
                            movie.title.toLowerCase().includes(query) ||
                            movie.director.toLowerCase().includes(query) ||
                            movie.cast.some(actor => actor.toLowerCase().includes(query))
                        );
                        
                        UI.renderFilteredMovies(filtered);
                    });
                }

                // People search
                const peopleSearch = document.getElementById('people-search');
                if (peopleSearch) {
                    peopleSearch.addEventListener('input', (e) => {
                        const query = e.target.value.toLowerCase();
                        const type = State.get('selectedPersonType');
                        const peopleMap = State.get(type);
                        const people = Array.from(peopleMap.entries())
                            .filter(([name]) => name.toLowerCase().includes(query))
                            .sort((a, b) => b[1].count - a[1].count);
                        
                        UI.renderFilteredPeople(people);
                    });
                }
            },

            // Render filtered movies
            renderFilteredMovies: (movies) => {
                const container = document.getElementById('movies-list');
                container.innerHTML = movies.map((movie, index) => `
                    <div class=\"movie-item\" data-index=\"${State.get('movies').indexOf(movie)}\" style=\"animation-delay: ${index * 50}ms\">
                        <h4>${movie.title}</h4>
                        <div class=\"meta\">${movie.year} • ${movie.rating} • ${movie.director}</div>
                    </div>
                `).join('');

                // Re-add click listeners
                container.querySelectorAll('.movie-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const index = parseInt(item.getAttribute('data-index'));
                        const movie = State.get('movies')[index];
                        
                        container.querySelectorAll('.movie-item').forEach(el => 
                            el.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        UI.renderMovieDetails(movie);
                    });
                });
            },

            // Render filtered people
            renderFilteredPeople: (people) => {
                const container = document.getElementById('people-list');
                container.innerHTML = people.map(([name, data], index) => `
                    <div class=\"person-item\" data-name=\"${name}\" style=\"animation-delay: ${index * 50}ms\">
                        <h4>${name}</h4>
                        <div class=\"meta\">${data.count} filmes • Nota média: ${data.averageRating.toFixed(1)}</div>
                    </div>
                `).join('');

                // Re-add click listeners
                container.querySelectorAll('.person-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const name = item.getAttribute('data-name');
                        const type = State.get('selectedPersonType');
                        const peopleMap = State.get(type);
                        
                        container.querySelectorAll('.person-item').forEach(el => 
                            el.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        UI.renderPersonDetails(name, peopleMap.get(name));
                    });
                });
            },

            // Setup people filter
            setupPeopleFilter: () => {
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const type = btn.getAttribute('data-type');
                        
                        // Update active button
                        document.querySelectorAll('.filter-btn').forEach(b => 
                            b.classList.remove('active'));
                        btn.classList.add('active');
                        
                        State.set('selectedPersonType', type);
                        UI.renderPeopleList();
                    });
                });
            },

            setupResetButton: () => {
                const btn = document.getElementById('reset-data-btn');
                if (!btn) return;
                btn.addEventListener('click', () => {
                    if (confirm('Tem a certeza de que quer apagar todos os dados e recomeçar?')) {
                        localStorage.removeItem('letterboxdProcessedData');
                        State.clear();
                        Charts.destroyAll();
                        window.location.reload();
                    }
                });
            },

            setupAboutButton: () => {
                const btn = document.getElementById('about-btn');
                if (!btn) return;
                btn.addEventListener('click', () => {
                    const aboutContentHtml = `
                        <div class=\"summary-section\" style=\"grid-column: 1 / -1;\">
                            <h3>O Que é Isto?</h3>
                            <p>O Letterboxd Stats Dashboard é uma ferramenta para visualizar as suas estatísticas de filmes a partir dos dados que exporta do Letterboxd.</p>
                        </div>
                        <div class=\"summary-section\" style=\"grid-column: 1 / -1;\">
                            <h3>Como Usar</h3>
                            <p>1. Vá ao seu perfil Letterboxd, clique no ícone de engrenagem (Definições) e vá para a aba 'Dados'.</p>
                            <p>2. Clique em 'Exportar os seus dados' e aguarde o email com o link para o zip.</p>
                            <p>3. Descomprima o ficheiro e encontre o <strong>ratings.csv</strong>.</p>
                            <p>4. Arraste e solte ou selecione esse ficheiro na tela inicial desta aplicação.</p>
                        </div>
                        <div class=\"summary-section\" style=\"grid-column: 1 / -1;\">
                            <h3>Créditos</h3>
                            <p>Dados dos filmes fornecidos pela <a href=\"https://www.themoviedb.org/\" target=\"_blank\" rel=\"noopener noreferrer\">The Movie Database (TMDB)</a>.</p>
                            <p>Gráficos criados com <a href=\"https://www.chartjs.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Chart.js</a>.</p>
                            <p>Desenvolvido por <a href=\"https://github.com/gustavoskx\" target=\"_blank\" rel=\"noopener noreferrer\">gustavoskx</a>.</p>
                        </div>
                    `;
                    UI.showSummaryModal('Sobre o Projeto', aboutContentHtml);
                });
            },

            // Loading and progress methods
            showLoadingMessage: (message) => {
                const setupContainer = document.getElementById('setup-container');
                const existingLoader = setupContainer.querySelector('.loading-overlay');
                
                if (existingLoader) {
                    existingLoader.remove();
                }

                const loader = document.createElement('div');
                loader.className = 'loading-overlay';
                loader.innerHTML = `
                    <div class=\"loading-content\">
                        <div class=\"loading-spinner\"></div>
                        <h3>${message}</h3>
                        <div class=\"progress-bar\">
                            <div class=\"progress-fill\" id=\"progress-fill\"></div>
                        </div>
                        <p id=\"progress-text\">Preparando...</p>
                    </div>
                `;
                
                setupContainer.appendChild(loader);
            },

            updateProgress: (current, total, movieTitle) => {
                const progressFill = document.getElementById('progress-fill');
                const progressText = document.getElementById('progress-text');
                
                if (progressFill && progressText) {
                    const percentage = (current / total) * 100;
                    progressFill.style.width = `${percentage}%`;
                    progressText.textContent = `Processando: ${movieTitle} (${current}/${total})`;
                }
            },

            hideLoadingMessage: () => {
                const loader = document.querySelector('.loading-overlay');
                if (loader) {
                    loader.remove();
                }
            },

        };
    })();

    // ========================================
    // API MODULE
    // ========================================
    const API = (function() {
        const baseURL = 'https://api.themoviedb.org/3';

        return {
            searchMovie: async (title, year) => {
                const apiKey = State.get('tmdbApiKey');
                const url = `${baseURL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&year=${year}`;
                
                try {
                    const response = await fetch(url);
                    const data = await response.json();
                    return data.results || [];
                } catch (error) {
                    console.error('Erro na busca do filme:', error);
                    return [];
                }
            },

            getMovieDetails: async (movieId) => {
                const apiKey = State.get('tmdbApiKey');
                const url = `${baseURL}/movie/${movieId}?api_key=${apiKey}&append_to_response=credits`;
                
                try {
                    const response = await fetch(url);
                    return await response.json();
                } catch (error) {
                    console.error('Erro ao obter detalhes do filme:', error);
                    return null;
                }
            }
        };
    })();

    // ========================================
    // DATA PROCESSING MODULE
    // ========================================
    const Data = (function() {
        // Helper function to generate HTML for a list of items
        const generateListHTML = (items, title) => {
            if (!items || items.length === 0) return '';
            return `
                <div class=\"detail-item\">
                    <h4>${title}</h4>
                    <ul>
                        ${items.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `;
        };

        return {
            // Build indices (directors, actors, genres) from an array of movies
            buildIndices: (movies) => {
                const directors = new Map();
                const actors = new Map();
                const genres = new Map();

                movies.forEach(movie => {
                    // Directors
                    const directorNames = (movie.director || '').split(', ').filter(name => name);
                    directorNames.forEach(directorName => {
                        if (!directors.has(directorName)) {
                            directors.set(directorName, {
                                count: 0,
                                totalRating: 0,
                                movies: [],
                                firstMovie: movie,
                                lastMovie: movie
                            });
                        }

                        const directorData = directors.get(directorName);
                        directorData.count++;
                        directorData.totalRating += movie.rating || 0;
                        directorData.movies.push(movie);
                        if (movie.dateWatched && new Date(movie.dateWatched) < new Date(directorData.firstMovie.dateWatched || directorData.firstMovie.date)) {
                            directorData.firstMovie = movie;
                        }
                        if (movie.dateWatched && new Date(movie.dateWatched) > new Date(directorData.lastMovie.dateWatched || directorData.lastMovie.date)) {
                            directorData.lastMovie = movie;
                        }
                    });

                    // Actors
                    (movie.cast || []).forEach(actorName => {
                        if (!actorName) return;
                        if (!actors.has(actorName)) {
                            actors.set(actorName, {
                                count: 0,
                                totalRating: 0,
                                movies: [],
                                firstMovie: movie,
                                lastMovie: movie
                            });
                        }

                        const actorData = actors.get(actorName);
                        actorData.count++;
                        actorData.totalRating += movie.rating || 0;
                        actorData.movies.push(movie);
                        if (movie.dateWatched && new Date(movie.dateWatched) < new Date(actorData.firstMovie.dateWatched || actorData.firstMovie.date)) {
                            actorData.firstMovie = movie;
                        }
                        if (movie.dateWatched && new Date(movie.dateWatched) > new Date(actorData.lastMovie.dateWatched || actorData.lastMovie.date)) {
                            actorData.lastMovie = movie;
                        }
                    });

                    // Genres
                    (movie.genres || []).forEach(genre => {
                        if (!genre) return;
                        if (!genres.has(genre)) {
                            genres.set(genre, {
                                count: 0,
                                totalRating: 0,
                                movies: []
                            });
                        }

                        const genreData = genres.get(genre);
                        genreData.count++;
                        genreData.totalRating += movie.rating || 0;
                        genreData.movies.push(movie);
                    });
                });

                // Calculate averages
                directors.forEach(data => {
                    data.averageRating = data.count > 0 ? data.totalRating / data.count : 0;
                });

                actors.forEach(data => {
                    data.averageRating = data.count > 0 ? data.totalRating / data.count : 0;
                });

                genres.forEach(data => {
                    data.averageRating = data.count > 0 ? data.totalRating / data.count : 0;
                });

                return { directors, actors, genres };
            },
            processCSV: async (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    
                    reader.onload = async (e) => {
                        try {
                            const csv = e.target.result;
                            const movies = Data.parseCSV(csv);
                            
                            // Process movies data
                            await Data.processMovies(movies);
                            
                            // Calculate statistics
                            Data.calculateStats();
                            
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    };
                    
                    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
                    reader.readAsText(file);
                });
            },

            parseCSV: (csv) => {
                const lines = csv.split('\n');
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const movies = [];

                console.log('Headers encontrados:', headers);

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const values = Data.parseCSVLine(line);
                    const movie = {};

                    headers.forEach((header, index) => {
                        movie[header.toLowerCase().replace(/\s+/g, '')] = values[index] || '';
                    });

                    // Parse specific fields for Letterboxd format
                    movie.rating = parseFloat(movie.rating) || 0;
                    movie.year = parseInt(movie.year) || 0;
                    movie.title = movie.name || '';
                    movie.dateWatched = movie.date || '';
                    
                    // Initialize additional fields that will be populated from TMDB
                    movie.director = '';
                    movie.cast = [];
                    movie.genres = [];
                    movie.runtime = 0;
                    movie.posterPath = '';
                    movie.overview = '';
                    movie.tmdbId = null;

                    movies.push(movie);
                }

                console.log(`CSV parseado: ${movies.length} filmes encontrados`);
                console.log('Primeiro filme:', movies[0]);

                return movies;
            },

            parseCSVLine: (line) => {
                const values = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];

                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }

                values.push(current.trim());
                return values;
            },

            processMovies: async (movies) => {
                console.log('Iniciando processamento de', movies.length, 'filmes');
                
                const processedMovies = [];

                // Show loading message
                UI.showLoadingMessage('Processando dados dos filmes...');

                for (let i = 0; i < movies.length; i++) {
                    const movie = movies[i];
                    UI.updateProgress(i + 1, movies.length, movie.title);

                    try {
                        const searchResults = await API.searchMovie(movie.title, movie.year);
                        const bestMatch = searchResults.find(r => r.title.toLowerCase() === movie.title.toLowerCase());
                        const searchResult = bestMatch || searchResults[0];

                        if (searchResult) {
                            const details = await API.getMovieDetails(searchResult.id);
                            if (details) {
                                // Extract director
                                const director = details.credits.crew.find(p => p.job === 'Director');
                                movie.director = director ? director.name : 'N/A';

                                // Extract cast
                                movie.cast = details.credits.cast.slice(0, 30).map(p => p.name);

                                // Extrair país
                                if (details.production_countries && details.production_countries.length > 0) {
                                    movie.country = details.production_countries[0].name;
                                } else {
                                    movie.country = 'Desconhecido';
                                }

                                // Extract other details
                                movie.genres = details.genres.map(g => g.name);
                                movie.runtime = details.runtime || 0;
                                movie.posterPath = details.poster_path || '';
                                movie.overview = details.overview || '';
                                movie.tmdbId = details.id;
                            }
                        }
                    } catch (error) {
                        console.warn(`Erro ao processar o filme ${movie.title}:`, error);
                    }

                    processedMovies.push(movie);
                }

                // Build indices from processed movies
                const { directors, actors, genres } = Data.buildIndices(processedMovies);

                console.log('Processamento concluído:', {
                    movies: processedMovies.length,
                    directors: directors.size,
                    actors: actors.size,
                    genres: genres.size
                });

                // Update state
                State.update({
                    movies: processedMovies,
                    directors,
                    actors,
                    genres
                });

                // Hide loading message
                UI.hideLoadingMessage();

                // Save processed data to localStorage for session persistence
                try {
                    localStorage.setItem('letterboxdProcessedData', JSON.stringify(processedMovies));
                    console.log('Dados dos filmes guardados no localStorage.');
                } catch (e) {
                    console.error('Erro ao guardar dados no localStorage:', e);
                    UI.showToast('Não foi possível guardar a sessão. O limite de armazenamento pode ter sido excedido.', 'error', 7000);
                }
                
                console.log('Estado atualizado, dados disponíveis:', State.get('directors').size);
            },

            calculateStats: () => {
                const movies = State.get('movies');
                if (movies.length === 0) return;

                // Sort movies by date watched
                const sortedMovies = [...movies].sort((a, b) => 
                    new Date(a.dateWatched || a.date) - new Date(b.dateWatched || b.date)
                );

                // Calculate various statistics
                const totalMovies = movies.length;
                const averageRating = movies.reduce((sum, m) => sum + m.rating, 0) / totalMovies;
                const totalRuntime = movies.reduce((sum, m) => sum + (m.runtime || 0), 0);
                const averageRuntime = totalRuntime / totalMovies;

                // Year range
                const years = movies.map(m => m.year).filter(y => y > 0);
                const yearRange = years.length > 0 ? Math.max(...years) - Math.min(...years) : 0;

                State.update({
                    stats: {
                        totalMovies,
                        averageRating,
                        totalRuntime,
                        averageRuntime,
                        yearRange,
                        sortedMovies
                    }
                });
            },

            getChartDetails: (chartType) => {
                const movies = State.get('movies');
                let html = '';

                switch (chartType) {
                    case 'summary': {
                        const stats = State.get('stats');
                        const movies = State.get('movies');
                        if (!stats || !movies || movies.length === 0) return '<p>Estatísticas não disponíveis.</p>';

                        const { totalMovies, averageRating, totalRuntime, sortedMovies } = stats;
                        
                        const firstMovie = sortedMovies[0];
                        const lastMovie = sortedMovies[sortedMovies.length - 1];
                        
                        const ratings = movies.map(m => m.rating);
                        const maxRating = Math.max(...ratings);
                        const minRating = Math.min(...ratings);

                        const highestRated = movies.filter(m => m.rating === maxRating);
                        const lowestRated = movies.filter(m => m.rating === minRating);

                        let summaryHtml = '';

                        // Total de Filmes
                        summaryHtml += `
                            <div class=\"summary-item\">
                                <h4 class=\"summary-item-title\">Total de Filmes</h4>
                                <p class=\"summary-item-value\">${totalMovies}</p>
                            </div>
                        `;

                        // Nota Média
                        summaryHtml += `
                            <div class=\"summary-item\">
                                <h4 class=\"summary-item-title\">Nota Média</h4>
                                <p class=\"summary-item-value\">${averageRating.toFixed(2)}</p>
                            </div>
                        `;

                        // Tempo Total Assistido
                        summaryHtml += `
                            <div class=\"summary-item\">
                                <h4 class=\"summary-item-title\">Tempo Total Assistido</h4>
                                <p class=\"summary-item-value\">${Math.floor(totalRuntime / 60)}h ${totalRuntime % 60}m</p>
                            </div>
                        `;

                        // Primeiro Filme
                        if (firstMovie) {
                            summaryHtml += `
                                <div class=\"summary-item\">
                                    <h4 class=\"summary-item-title\">Primeiro Filme</h4>
                                    <p class=\"summary-item-value\">${firstMovie.title} (${firstMovie.year}) - ${firstMovie.dateWatched}</p>
                                </div>
                            `;
                        }

                        // Último Filme
                        if (lastMovie) {
                            summaryHtml += `
                                <div class=\"summary-item\">
                                    <h4 class=\"summary-item-title\">Último Filme</h4>
                                    <p class=\"summary-item-value\">${lastMovie.title} (${lastMovie.year}) - ${lastMovie.dateWatched}</p>
                                </div>
                            `;
                        }

                        // Melhor(es) Filme(s)
                        if (highestRated.length > 0) {
                            summaryHtml += `
                                <div class=\"summary-item\">
                                    <h4 class=\"summary-item-title\">Melhor(es) Filme(s) (${maxRating.toFixed(1)})</h4>
                                    <div class=\"summary-item-value\">
                                        <ul>
                                            ${highestRated.map(m => `<li>${m.title}</li>`).join('')}
                                        </ul>
                                    </div>
                                </div>
                            `;
                        }

                        // Pior(es) Filme(s)
                        if (lowestRated.length > 0) {
                             summaryHtml += `
                                <div class=\"summary-item\">
                                    <h4 class=\"summary-item-title\">Pior(es) Filme(s) (${minRating.toFixed(1)})</h4>
                                    <div class=\"summary-item-value\">
                                        <ul>
                                            ${lowestRated.map(m => `<li>${m.title}</li>`).join('')}
                                        </ul>
                                    </div>
                                </div>
                            `;
                        }

                        html = summaryHtml;
                        
                        break;
                    }
                    case 'rating-distribution': {
                        const ratings = movies.map(m => m.rating);
                        const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
                        const sortedRatings = [...ratings].sort((a, b) => a - b);
                        const median = sortedRatings.length % 2 === 0 ? 
                            (sortedRatings[sortedRatings.length / 2 - 1] + sortedRatings[sortedRatings.length / 2]) / 2 : 
                            sortedRatings[Math.floor(sortedRatings.length / 2)];
                        
                        const modeMap = {};
                        let maxCount = 0;
                        let modes = [];
                        ratings.forEach(rating => {
                            modeMap[rating] = (modeMap[rating] || 0) + 1;
                            if (modeMap[rating] > maxCount) {
                                maxCount = modeMap[rating];
                                modes = [rating];
                            } else if (modeMap[rating] === maxCount) {
                                modes.push(rating);
                            }
                        });

                        const stdDev = Math.sqrt(ratings.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / ratings.length);

                        const highestRated = movies.filter(m => m.rating === 5.0).map(m => `${m.title} (${m.year})`);
                        const lowestRated = movies.filter(m => m.rating === Math.min(...ratings)).map(m => `${m.title} (${m.year})`);

                        html += `<div class=\"detail-item\"><h4>Estatísticas Chave</h4><ul>
                            <li><strong>Média:</strong> ${mean.toFixed(2)}</li>
                            <li><strong>Mediana:</strong> ${median.toFixed(1)}</li>
                            <li><strong>Moda:</strong> ${modes.join(', ')}</li>
                            <li><strong>Desvio Padrão:</strong> ${stdDev.toFixed(2)}</li>
                        </ul></div>`;
                        html += generateListHTML(highestRated, 'Filmes com Nota Máxima (5.0)');
                        html += generateListHTML(lowestRated, 'Filmes com a Menor Nota');
                        break;
                    }

                    case 'directors':
                    case 'actors': {
                        const personType = chartType === 'directors' ? 'Diretores' : 'Atores';
                        const peopleMap = State.get(chartType);
                        const sortedPeople = Array.from(peopleMap.entries()).sort((a, b) => b[1].count - a[1].count);

                        html += `<div class=\"detail-item\"><h4>Resumo</h4><ul>
                            <li><strong>Total de ${personType}:</strong> ${peopleMap.size}</li>
                        </ul></div>`;

                        const listItems = sortedPeople.map(([name, data]) => 
                            `<li><span>${name}</span><span>${data.count} filmes • ${data.averageRating.toFixed(1)}</span></li>`
                        );
                        html += generateListHTML(listItems, `Lista Completa de ${personType}`);
                        break;
                    }

                    case 'genres': {
                        const genresMap = State.get('genres');
                        const sortedGenres = Array.from(genresMap.entries()).sort((a, b) => b[1].count - a[1].count);
                        const favoriteGenre = sortedGenres[0][0];
                        const genreMovies = movies.filter(m => m.genres.includes(favoriteGenre));
                        const bestInGenre = genreMovies.reduce((best, movie) => movie.rating > best.rating ? movie : best, genreMovies[0]);
                        const worstInGenre = genreMovies.reduce((worst, movie) => movie.rating < worst.rating ? movie : worst, genreMovies[0]);

                        html += `<div class=\"detail-item\"><h4>Gênero Favorito</h4><ul>
                            <li><strong>${favoriteGenre}</strong> (${sortedGenres[0][1].count} filmes)</li>
                        </ul></div>`;
                        html += `<div class=\"detail-item\"><h4>Melhor & Pior de ${favoriteGenre}</h4><ul>
                            <li><strong>Melhor:</strong> ${bestInGenre.title} (${bestInGenre.rating})</li>
                            <li><strong>Pior:</strong> ${worstInGenre.title} (${worstInGenre.rating})</li>
                        </ul></div>`;
                        
                        const avgRatingByGenre = sortedGenres.map(([name, data]) => 
                            `<li><span>${name}</span><span>${data.averageRating.toFixed(1)}</span></li>`
                        );
                        html += generateListHTML(avgRatingByGenre, 'Nota Média por Gênero');
                        break;
                    }

                    case 'rating-by-year': {
                        const yearData = {};
                        movies.forEach(movie => {
                            if (movie.year > 0) {
                                if (!yearData[movie.year]) {
                                    yearData[movie.year] = { total: 0, count: 0, movies: [] };
                                }
                                yearData[movie.year].total += movie.rating;
                                yearData[movie.year].count++;
                                yearData[movie.year].movies.push(movie);
                            }
                        });

                        const yearAverages = Object.entries(yearData).map(([year, data]) => ({
                            year: parseInt(year),
                            avg: data.total / data.count,
                            movies: data.movies
                        }));

                        const bestYear = yearAverages.reduce((best, year) => year.avg > best.avg ? year : best, { avg: 0 });
                        const worstYear = yearAverages.reduce((worst, year) => year.avg < worst.avg ? year : worst, { avg: 6 });

                        html += `<div class=\"detail-item\"><h4>Melhor Ano</h4><ul>
                            <li><strong>${bestYear.year}</strong> (Média ${bestYear.avg.toFixed(2)})</li>
                            ${bestYear.movies.slice(0, 3).map(m => `<li>- ${m.title} (${m.rating})</li>`).join('')}
                        </ul></div>`;
                        html += `<div class=\"detail-item\"><h4>Pior Ano</h4><ul>
                            <li><strong>${worstYear.year}</strong> (Média ${worstYear.avg.toFixed(2)})</li>
                        </ul></div>`;

                        const tableItems = yearAverages.sort((a, b) => b.year - a.year).map(y => 
                            `<li><span>${y.year}</span><span>${y.avg.toFixed(2)}</span></li>`
                        );
                        html += generateListHTML(tableItems, 'Tabela de Dados (Ano | Média)');
                        break;
                    }

                    case 'runtime': {
                        const moviesWithRuntime = movies.filter(m => m.runtime > 0);
                        const totalRuntime = moviesWithRuntime.reduce((sum, m) => sum + m.runtime, 0);
                        const avgRuntime = totalRuntime / moviesWithRuntime.length;
                        const longestMovie = moviesWithRuntime.reduce((longest, movie) => movie.runtime > longest.runtime ? movie : longest, { runtime: 0 });
                        const shortestMovie = moviesWithRuntime.reduce((shortest, movie) => movie.runtime < shortest.runtime ? movie : shortest, { runtime: Infinity });

                        html += `<div class=\"detail-item\"><h4>Estatísticas de Duração</h4><ul>
                            <li><strong>Média:</strong> ${Math.round(avgRuntime)} min (${Math.floor(avgRuntime / 60)}h ${Math.round(avgRuntime % 60)}m)</li>
                        </ul></div>`;
                        html += `<div class=\"detail-item\"><h4>Extremos</h4><ul>
                            <li><strong>Mais Longo:</strong> ${longestMovie.title} (${longestMovie.runtime} min)</li>
                            <li><strong>Mais Curto:</strong> ${shortestMovie.title} (${shortestMovie.runtime} min)</li>
                        </ul></div>`;
                        break;
                    }

                    default:
                        html = '<p>Nenhum detalhe disponível para este gráfico.</p>';
                }

                return html;
            }
        };
    })();

    // ========================================
    // CHARTS MODULE
    // ========================================
    const Charts = (function() {
        const chartInstances = new Map();

        // Helper function to generate a color based on rating
        const getRatingColor = (rating) => {
            // Scale rating from 0.5-5 to a 0-1 value
            const scaledRating = (rating - 0.5) / 4.5;
            // Interpolate between a light blue and a dark blue
            const startColor = [102, 126, 234]; // --primary-color-light
            const endColor = [118, 75, 162];     // --primary-color-dark
            
            const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * scaledRating);
            const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * scaledRating);
            const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * scaledRating);

            return `rgb(${r}, ${g}, ${b})`;
        };

        return {
            // Create all dashboard charts
            createAllCharts: () => {
                Charts.createSummaryChart();
                Charts.createDirectorsChart();
                Charts.createGenresChart();
                Charts.createRatingDistributionChart();
                Charts.createRatingByYearChart();
                Charts.createMoviesByMonthChart();
                Charts.createRatingVsYearChart();
                Charts.createActorsChart();
                Charts.createRuntimeChart();
            },

            // Summary chart (cards)
            createSummaryChart: () => {
                const stats = State.get('stats');
                if (!stats) return;

                const container = document.getElementById('summary-chart');
                container.innerHTML = `
                    <div class=\"summary-card\">
                        <h4>Total de Filmes</h4>
                        <div class=\"value\">${stats.totalMovies}</div>
                    </div>
                    <div class=\"summary-card\">
                        <h4>Nota Média</h4>
                        <div class=\"value\">${stats.averageRating.toFixed(1)}</div>
                    </div>
                    <div class=\"summary-card\">
                        <h4>Tempo Total</h4>
                        <div class=\"value\">${Math.round(stats.totalRuntime / 60)}h</div>
                    </div>
                    <div class=\"summary-card\">
                        <h4>Anos de Filmes</h4>
                        <div class=\"value\">${stats.yearRange}</div>
                    </div>
                `;
            },

            // Directors chart
            createDirectorsChart: () => {
                const directors = State.get('directors');
                if (!directors || directors.size === 0) return;

                const topDirectors = Array.from(directors.entries())
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10);

                const ctx = document.getElementById('directors-chart').getContext('2d');
                chartInstances.set('directors', new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: topDirectors.map(([name]) => name),
                        datasets: [{
                            label: 'Filmes Assistidos',
                            data: topDirectors.map(([, data]) => data.count),
                            backgroundColor: topDirectors.map(([, data]) => getRatingColor(data.averageRating)),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        scales: {
                            x: {
                                beginAtZero: true
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                }));
            },

            // Genres chart
            createGenresChart: () => {
                const genres = State.get('genres');
                if (!genres || genres.size === 0) return;

                const topGenres = Array.from(genres.entries())
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10);

                const ctx = document.getElementById('genres-chart').getContext('2d');
                chartInstances.set('genres', new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: topGenres.map(([name]) => name),
                        datasets: [{
                            label: 'Contagem de Filmes',
                            data: topGenres.map(([, data]) => data.count),
                            backgroundColor: '#4facfe'
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                }));
            },

             // Rating distribution chart
             createRatingDistributionChart: () => {
                 const movies = State.get('movies');
                 const stats = State.get('stats');
                 if (!stats) return;

                 const distribution = {};
                 movies.forEach(movie => {
                     const rating = movie.rating.toFixed(1);
                     distribution[rating] = (distribution[rating] || 0) + 1;
                 });

                 const sortedRatings = Object.keys(distribution)
                     .map(r => parseFloat(r))
                     .sort((a, b) => a - b);

                 const ctx = document.getElementById('rating-distribution-chart').getContext('2d');
                 chartInstances.set('rating-distribution', new Chart(ctx, {
                     type: 'bar',
                     data: {
                         labels: sortedRatings.map(r => r.toFixed(1)),
                         datasets: [{
                             label: 'Quantidade',
                             data: sortedRatings.map(r => distribution[r.toFixed(1)]),
                             backgroundColor: '#667eea'
                         }]
                     },
                     options: {
                         responsive: true,
                         scales: {
                             y: {
                                 beginAtZero: true
                             }
                         },
                         plugins: {
                             annotation: {
                                 annotations: {
                                     line1: {
                                         type: 'line',
                                         xMin: stats.averageRating,
                                         xMax: stats.averageRating,
                                         borderColor: '#f5576c',
                                         borderWidth: 2,
                                         borderDash: [6, 6],
                                         label: {
                                             content: `Média: ${stats.averageRating.toFixed(2)}`,
                                             enabled: true,
                                             position: 'end'
                                         }
                                     }
                                 }
                             }
                         }
                     }
                 }));
             },

            // Rating by year chart
            createRatingByYearChart: () => {
                const movies = State.get('movies');
                const yearData = {};

                movies.forEach(movie => {
                    if (movie.year > 0) {
                        if (!yearData[movie.year]) {
                            yearData[movie.year] = { total: 0, count: 0 };
                        }
                        yearData[movie.year].total += movie.rating;
                        yearData[movie.year].count++;
                    }
                });

                const years = Object.keys(yearData).sort((a, b) => a - b);
                const averages = years.map(year => yearData[year].total / yearData[year].count);
                const counts = years.map(year => yearData[year].count);

                const ctx = document.getElementById('rating-by-year-chart').getContext('2d');
                chartInstances.set('rating-by-year', new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: years,
                        datasets: [{
                            label: 'Nota Média',
                            data: averages,
                            borderColor: '#667eea',
                            backgroundColor: 'rgba(102, 126, 234, 0.1)',
                            tension: 0.4,
                            pointRadius: counts.map(c => 2 + Math.log(c + 1) * 2),
                            pointHoverRadius: counts.map(c => 4 + Math.log(c + 1) * 2)
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 5
                            }
                        }
                    }
                }));
            },

             // Movies by month chart
             createMoviesByMonthChart: () => {
                 const movies = State.get('movies');
                 const monthData = {};

                 movies.forEach(movie => {
                     const date = new Date(movie.dateWatched || movie.date);
                     if (!isNaN(date.getTime())) {
                         const month = date.getMonth();
                         monthData[month] = (monthData[month] || 0) + 1;
                     }
                 });

                 const monthNames = [
                     'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                     'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
                 ];

                 const ctx = document.getElementById('movies-by-month-chart').getContext('2d');
                 chartInstances.set('movies-by-month', new Chart(ctx, {
                     type: 'line',
                     data: {
                         labels: monthNames,
                         datasets: [{
                             label: 'Filmes Assistidos',
                             data: monthNames.map((_, index) => monthData[index] || 0),
                             borderColor: '#667eea',
                             backgroundColor: 'rgba(102, 126, 234, 0.1)',
                             tension: 0.4
                         }]
                     },
                     options: {
                         responsive: true,
                         scales: {
                             y: {
                                 beginAtZero: true
                             }
                         }
                     }
                 }));
             },

            // Rating vs year scatter plot
            createRatingVsYearChart: () => {
                const movies = State.get('movies');
                const data = movies
                    .filter(m => m.year > 0)
                    .map(m => ({ x: m.year, y: m.rating }));

                const ctx = document.getElementById('rating-vs-year-chart').getContext('2d');
                chartInstances.set('rating-vs-year', new Chart(ctx, {
                    type: 'scatter',
                    data: {
                        datasets: [{
                            label: 'Filmes',
                            data: data,
                            backgroundColor: 'rgba(102, 126, 234, 0.4)'
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Ano de Lançamento'
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'Sua Nota'
                                },
                                beginAtZero: true,
                                max: 5
                            }
                        }
                    }
                }));
            },

            // Actors chart
            createActorsChart: () => {
                const actors = State.get('actors');
                if (!actors || actors.size === 0) return;

                const topActors = Array.from(actors.entries())
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10);

                 const ctx = document.getElementById('actors-chart').getContext('2d');
                 chartInstances.set('actors', new Chart(ctx, {
                     type: 'bar',
                     data: {
                         labels: topActors.map(([name]) => name),
                         datasets: [{
                             label: 'Filmes Assistidos',
                             data: topActors.map(([, data]) => data.count),
                             backgroundColor: topActors.map(([, data]) => getRatingColor(data.averageRating)),
                             borderWidth: 1
                         }]
                     },
                     options: {
                         responsive: true,
                         indexAxis: 'y',
                         scales: {
                             x: {
                                 beginAtZero: true
                             }
                         },
                         plugins: {
                            legend: {
                                display: false
                            }
                        }
                     }
                 }));
             },

            // Runtime chart
            createRuntimeChart: () => {
                const movies = State.get('movies');
                const runtimeRanges = {
                    '< 90m': 0,
                    '90-120m': 0,
                    '120-150m': 0,
                    '150-180m': 0,
                    '> 180m': 0
                };

                let moviesWithRuntime = 0;
                movies.forEach(movie => {
                    const runtime = parseInt(movie.runtime);
                    if (runtime && runtime > 0) {
                        moviesWithRuntime++;
                        if (runtime < 90) runtimeRanges['< 90m']++;
                        else if (runtime <= 120) runtimeRanges['90-120m']++;
                        else if (runtime <= 150) runtimeRanges['120-150m']++;
                        else if (runtime <= 180) runtimeRanges['150-180m']++;
                        else runtimeRanges['> 180m']++;
                    }
                });

                if (moviesWithRuntime === 0) return; // Don't render if no data

                const ctx = document.getElementById('runtime-chart').getContext('2d');
                chartInstances.set('runtime', new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(runtimeRanges),
                        datasets: [{
                            label: 'Contagem de Filmes',
                            data: Object.values(runtimeRanges),
                            backgroundColor: '#43e97b'
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                }));
            },

            // Get chart data for modal
            getChartData: (chartType) => {
                const chart = chartInstances.get(chartType);
                if (!chart) return null;

                const originalConfig = chart.config;
                
                const modalConfig = {
                    type: originalConfig.type,
                    data: {
                        labels: [...originalConfig.data.labels],
                        datasets: originalConfig.data.datasets.map(dataset => ({
                            ...dataset,
                            data: [...dataset.data]
                        }))
                    },
                    options: {
                        ...originalConfig.options,
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                            ...originalConfig.options.plugins,
                            legend: {
                                ...originalConfig.options.plugins?.legend,
                                display: true
                            }
                        }
                    }
                };

                return modalConfig;
            },


            // Destroy all charts
            destroyAll: () => {
                chartInstances.forEach(chart => chart.destroy());
                chartInstances.clear();
            }
        };
    })();

    // ========================================
    // MAIN APP MODULE
    // ========================================
    const App = (function() {
        return {
            init: async () => {
                // Attempt to load data from localStorage first
                const storedData = localStorage.getItem('letterboxdProcessedData');
                if (storedData) {
                    try {
                        const parsedData = JSON.parse(storedData);
                        if (Array.isArray(parsedData) && parsedData.length > 0) {
                            console.log('Dados encontrados no localStorage, a carregar sessão.');
                            State.update({ movies: parsedData });
                            
                            // Setup listeners and initialize main app
                            UI.setupNavigation();
                            UI.setupChartContainers();
                            UI.setupModalClose();
                            UI.setupSearch();
                            UI.setupPeopleFilter();
                            UI.setupResetButton();
                            UI.setupAboutButton();
                            
                            UI.showMainApp();
                            App.initialize();
                            return; // Stop execution to prevent showing setup
                        }
                    } catch (error) {
                        console.error('Erro ao analisar dados do localStorage, a limpar.', error);
                        localStorage.removeItem('letterboxdProcessedData');
                    }
                }

                // If no valid stored data, show the setup screen
                UI.showSetup();

                // Setup event listeners for the first time
                UI.setupForm();
                UI.setupNavigation();
                UI.setupChartContainers();
                UI.setupModalClose();
                UI.setupSearch();
                UI.setupPeopleFilter();
                UI.setupResetButton();
                UI.setupAboutButton();
            },

            initialize: () => {
                console.log('Inicializando aplicação...');
                
                // Create all charts
                console.log('Criando gráficos...');
                
                const movies = State.get('movies');

                if (movies && movies.length > 0) {
                    const indices = Data.buildIndices(movies);
                    State.update(indices);

                    Data.calculateStats();
                }

                // Ensure charts are fresh
                Charts.destroyAll();
                Charts.createAllCharts();
                
                
                // Show dashboard by default
                console.log('Mostrando dashboard...');
                UI.showView('dashboard');
                
                console.log('Aplicação inicializada!');
            }
        };
    })();

    // ========================================
    // INITIALIZE APPLICATION
    // ========================================
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });

    // Expose modules for debugging (optional)
    window.LetterboxdApp = {
        State,
        UI,
        API,
        Data,
        Charts,
        App
    };

})();