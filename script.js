// ======================================================================================
// === ВАЖНО: Обновите эти две переменные, используя ПОЛНЫЕ ССЫЛКИ НА ОПУБЛИКОВАННЫЙ CSV ===
// ======================================================================================

// URL-адрес CSV для листа "Target" (должен быть получен через Файл -> Опубликовать в интернете)
const TARGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=1172056164&single=true&output=csv';

// URL-адрес CSV для листа "Лист16" (должен быть получен через Файл -> Опубликовать в интернете)
const SALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=407492630&single=true&output=csv';

let allCombinedData = {}; // Объединенные данные, агрегированные по ГРУППАМ
let currentChart;         // Ссылка на объект Chart.js для ГРУПП
let currentTerritoryChart; // Ссылка на объект Chart.js для ТЕРРИТОРИЙ (НОВАЯ)
let selectedFilterGroup = 'All'; // Текущая выбранная группа для фильтрации


// ======================================================================================
// === ФУНКЦИИ ТОЧНОСТИ И ПАРСИНГА ЧИСЕЛ ===
// ======================================================================================

function cleanGroup(groupName) {
    if (!groupName) return '';

    let cleaned = groupName.toUpperCase()
        .split('(')[0]
        .split('-')[0]
        .trim();

    if (/^\d+$/.test(cleaned) || cleaned === '') {
        return ''; 
    }

    const parts = cleaned.split(/\s+/);

    if (parts.length > 0 && parts[0].length > 1 && parts[0].length <= 5) {
        return parts[0];
    }

    return cleaned;
}

/**
 * Преобразует европейский разделитель '123,45' в 123.45 и обеспечивает очистку.
 */
function cleanAndParseNumber(rawString) {
    if (!rawString) return NaN;

    let cleaned = rawString
        .trim()
        .replace(/^"|"$/g, '')        
        .replace(/\s/g, '')            
        .replace(/\u00A0/g, '')       
        .replace(/[^\d,\.\-]/g, '');  

    if (cleaned === '') return NaN;
    
    if (cleaned.includes(',')) {
        if (cleaned.includes('.')) {
            cleaned = cleaned.replace(/\./g, '');
        }
        cleaned = cleaned.replace(',', '.'); 
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? NaN : num;
}

/**
 * Исправляет ошибки точности чисел с плавающей запятой в JavaScript.
 */
function roundToPrecision(num, precision = 12) {
    if (Math.abs(num) < 1e-10) return 0;
    const factor = Math.pow(10, precision);
    const correctedNum = Math.round(num * factor) / factor;
    
    const finalFactor = 100;
    return Math.round(correctedNum * finalFactor) / finalFactor; 
}


// ======================================================================================
// === ФОРМАТИРОВАНИЕ И КЛАССЫ ===
// ======================================================================================

/**
 * Форматирование чисел: Выводит ЦЕЛЫЕ числа (0 знаков после запятой).
 */
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0,
    }).format(num);
}

/**
 * Форматирование процентов.
 */
function formatPercent(num) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

function getPercentClass(value) {
    if (value >= 1) return 'percent-good';
    if (value >= 0.85) return 'percent-ok';
    return 'percent-bad';
}


// ======================================================================================
// === ПАРСИНГ CSV (ОБНОВЛЕНО ДЛЯ ДЕТАЛЬНОГО ВЫВОДА) ===
// ======================================================================================

function parseSalesCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const detailedSalesData = []; 

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        
        if (row.length < 5) continue; 

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));

        const rawGroup = cleanRow[1] || '';
        const group = cleanGroup(rawGroup);
        const territory = cleanRow[2] || 'Не определено'; // <-- ПОЛЕ ПАРЕНТ / ТЕРРИТОРИЯ
        const usdValueString = cleanRow[4] || ''; 
        
        if (usdValueString.trim() === '') continue;
        
        let salesValue = cleanAndParseNumber(usdValueString); 
        
        if (!isNaN(salesValue) && salesValue !== 0) {
            detailedSalesData.push({
                Group: group,
                Sales: roundToPrecision(salesValue),
                Parent: territory // Сохраняем поле Парент
            });
        }
    }
    return detailedSalesData;
}

function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const detailedTargetData = []; 

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        
        if (row.length < 4) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));

        const rawGroup = cleanRow[2] || ''; 
        const group = cleanGroup(rawGroup);
        const usdValueString = cleanRow[3] || ''; 

        if (usdValueString.trim() === '') continue;

        let targetValue = cleanAndParseNumber(usdValueString); 
        
        if (!isNaN(targetValue) && targetValue !== 0) {
             detailedTargetData.push({
                Group: group,
                Target: roundToPrecision(targetValue)
            });
        }
    }
    return detailedTargetData;
}

// ======================================================================================
// === ОБЪЕДИНЕНИЕ И АГРЕГАЦИЯ ДАННЫХ ===
// ======================================================================================

function combineData(targets, sales) {
    const combined = {};

    // 1. Агрегация таргетов по группе
    targets.forEach(item => {
        const group = item.Group;
        if (!combined[group]) {
            // Инициализируем с пустым массивом для деталей продаж
            combined[group] = { target: 0, sales: 0, salesDetails: [] }; 
        }
        combined[group].target = roundToPrecision(combined[group].target + item.Target);
    });

    // 2. Добавление продаж и сохранение деталей для территорий
    sales.forEach(item => {
        const group = item.Group;
        if (!combined[group]) {
            // Если группа есть в продажах, но нет в таргетах
            combined[group] = { target: 0, sales: 0, salesDetails: [] };
        }
        combined[group].sales = roundToPrecision(combined[group].sales + item.Sales);
        
        // Самое главное: сохраняем детали продаж, включая Парент/Территорию
        combined[group].salesDetails.push({ 
            Sales: item.Sales, 
            Parent: item.Parent 
        });
    });

    return combined;
}

// ======================================================================================
// === ЛОГИКА ТЕРРИТОРИЙ (НОВЫЙ БЛОК) ===
// ======================================================================================

function aggregateDataByTerritory(data) {
    const aggregated = {};
    
    // Перебираем агрегированные данные по Группам
    Object.values(data).forEach(groupItem => {
        // Перебираем детальные продажи внутри каждой группы
        groupItem.salesDetails.forEach(detail => {
            const territory = detail.Parent || 'Не определено';
            const sales = detail.Sales;
            
            // Поскольку у нас нет Target по территориям в этом источнике, Target будет 0
            if (!aggregated[territory]) {
                aggregated[territory] = { target: 0, sales: 0 };
            }
            
            aggregated[territory].sales = roundToPrecision(aggregated[territory].sales + sales);
            // Target остается 0
        });
        
        // !!! ВНИМАНИЕ: Если Target по территориям нужен, его нужно добавить в TARGET CSV !!!
    });
    
    // Пересчитываем общий тотал для KPI Территорий
    let totalTarget = Object.values(aggregated).reduce((sum, item) => sum + item.target, 0);
    let totalSales = Object.values(aggregated).reduce((sum, item) => sum + item.sales, 0);

    return { aggregated, totalTarget, totalSales };
}


function displayTerritoryData(aggregatedData, totalTarget, totalSales) {
    const tbody = document.getElementById('territory-data-table-body');
    tbody.innerHTML = '';
    
    const sortedTerritories = Object.keys(aggregatedData).sort();

    // Заполняем таблицу
    sortedTerritories.forEach(territory => {
        const data = aggregatedData[territory];
        // Target === 0, Execution будет 0.00%
        const execution = (data.target === 0) ? 0 : roundToPrecision(data.sales / data.target);
        const difference = roundToPrecision(data.target - data.sales);

        const percentClass = getPercentClass(execution);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${territory}</td>
            <td class="align-right">${formatNumber(Math.round(data.target))}</td>
            <td class="align-right">${formatNumber(Math.round(data.sales))}</td>
            <td class="align-right ${percentClass}">${formatPercent(execution)}</td>
            <td class="align-right">${formatNumber(difference)}</td>
        `;
        tbody.appendChild(row);
    });

    // Общие итоги в футере таблицы и KPI
    const totalExecution = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    const totalExecutionClass = getPercentClass(totalExecution);
    const displayTotalTarget = Math.round(totalTarget);
    const displayTotalSales = Math.round(totalSales);
    const displayTotalDifference = displayTotalTarget - displayTotalSales;


    document.getElementById('territory-footer-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('territory-footer-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('territory-footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('territory-footer-percent').className = totalExecutionClass;
    document.getElementById('territory-footer-diff').textContent = formatNumber(displayTotalDifference);
    
    document.getElementById('territory-total-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('territory-total-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('territory-total-percent').textContent = formatPercent(totalExecution);
    document.getElementById('territory-total-percent').className = `kpi-percent ${totalExecutionClass}`;
    
    const kpiParent = document.getElementById('territory-total-percent').closest('.kpi-card');
    if(kpiParent) {
        kpiParent.style.borderColor = totalExecutionClass === 'percent-good' ? '#5cb85c' : totalExecutionClass === 'percent-ok' ? '#f0ad4e' : '#d9534f';
    }
    
    // Генерируем график для территорий
    renderTerritoryChart(aggregatedData);
}

// ======================================================================================
// === ОСНОВНАЯ ЛОГИКА И ВЫВОД (ОБНОВЛЕНО) ===
// ======================================================================================

function processData(dataToProcess) {
    
    // --- 1. Агрегация и отображение Групп ---
    let totalTarget = 0; 
    let totalSales = 0;   
    let tableBody = document.getElementById('data-table-body');
    tableBody.innerHTML = '';
    const chartLabels = [];
    const chartTargets = [];
    const chartSales = [];
    
    // Создаем копию для сортировки и фильтрации
    const filteredGroups = {};
    Object.keys(dataToProcess).forEach(key => {
        const groupKey = key.toUpperCase();
        // Исключаем TIER и UNGROUPED
        if (groupKey !== 'TIER' && !groupKey.startsWith('UNGROUPED')) {
            filteredGroups[key] = dataToProcess[key];
        }
    });

    const sortedGroups = Object.keys(filteredGroups).sort((a, b) => {
        return filteredGroups[b].target - filteredGroups[a].target;
    });

    for (const group of sortedGroups) {
        const item = filteredGroups[group];
        const target = Number(item.target) || 0; 
        const sales = Number(item.sales) || 0;     
        
        // A. Обновление точных сумм для расчета процента 
        totalTarget = roundToPrecision(totalTarget + target);
        totalSales = roundToPrecision(totalSales + sales);

        // B. Округление суммы группы до целого числа (для отображения)
        const roundedTarget = Math.round(target); 
        const roundedSales = Math.round(sales);     
        
        // C. Отображение в таблице
        const execution = (target === 0) ? 0 : roundToPrecision(sales / target); 
        const difference = roundToPrecision(target - sales);

        const row = document.createElement('tr');
        const percentClass = getPercentClass(execution);

        row.innerHTML = `
            <td>${group}</td>
            <td class="align-right">${formatNumber(roundedTarget)}</td> 
            <td class="align-right">${formatNumber(roundedSales)}</td>  
            <td class="align-right ${percentClass}">${formatPercent(execution)}</td>
            <td class="align-right">${formatNumber(Math.round(difference))}</td>
        `;
        tableBody.appendChild(row);

        chartLabels.push(group);
        chartTargets.push(target);
        chartSales.push(sales);
    }
    
    // РАСЧЕТ ИТОГОВ ДЛЯ ВЫВОДА
    const totalExecution = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    const displayTotalTarget = Math.round(totalTarget);
    const displayTotalSales = Math.round(totalSales);
    const displayTotalDifference = displayTotalTarget - displayTotalSales;
    const totalExecutionClass = getPercentClass(totalExecution);
    
    // Обновление HTML (KPI)
    document.getElementById('total-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('total-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('total-percent').textContent = formatPercent(totalExecution);
    document.getElementById('total-percent').className = `kpi-percent ${totalExecutionClass}`;

    // Обновление футера
    document.getElementById('footer-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('footer-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('footer-percent').className = totalExecutionClass;
    document.getElementById('footer-diff').textContent = formatNumber(displayTotalDifference);

    renderChart(chartLabels, chartTargets, chartSales);
    
    // --- 2. Агрегация и отображение Территорий (НОВЫЙ БЛОК) ---
    const { aggregated: territoryAggregated, totalTarget: territoryTotalTarget, totalSales: territoryTotalSales } = aggregateDataByTerritory(dataToProcess);
    displayTerritoryData(territoryAggregated, territoryTotalTarget, territoryTotalSales);

}

// ======================================================================================
// === ЛОГИКА ФИЛЬТРОВ ===
// ======================================================================================

function updateFilterButtons() {
    document.querySelectorAll('.filter-button').forEach(button => {
        button.classList.remove('active');
        if (button.textContent === selectedFilterGroup || (selectedFilterGroup === 'All' && button.textContent === 'All')) {
            button.classList.add('active');
        }
    });
}

function generateFilterButtons(data) {
    const filterContainer = document.getElementById('group-filters');
    filterContainer.innerHTML = ''; 

    const groups = new Set();
    Object.keys(data).forEach(group => {
        const groupKey = group.toUpperCase();
        if (groupKey !== 'TIER' && !groupKey.startsWith('UNGROUPED')) {
            groups.add(group);
        }
    });

    // Кнопка "Все"
    const allButton = document.createElement('button');
    allButton.textContent = 'All';
    allButton.classList.add('filter-button', 'all-button');
    if (selectedFilterGroup === 'All') allButton.classList.add('active');
    allButton.addEventListener('click', () => {
        selectedFilterGroup = 'All';
        updateFilterButtons();
        processData(allCombinedData); // Показываем все данные
    });
    filterContainer.appendChild(allButton);

    // Кнопки для каждой группы
    Array.from(groups).sort().forEach(group => {
        const button = document.createElement('button');
        button.textContent = group;
        button.classList.add('filter-button');
        if (selectedFilterGroup === group) button.classList.add('active');
        button.addEventListener('click', () => {
            selectedFilterGroup = group;
            updateFilterButtons();
            // Фильтруем данные для одной группы
            const filteredData = {};
            if (allCombinedData[group]) {
                filteredData[group] = allCombinedData[group];
            }
            processData(filteredData);
        });
        filterContainer.appendChild(button);
    });
}


// ======================================================================================
// === РЕНДЕРИНГ ГРАФИКОВ (ОБНОВЛЕНО ДЛЯ ТЕРРИТОРИЙ) ===
// ======================================================================================

function renderChart(labels, targetData, salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');

    if (currentChart) { 
        currentChart.destroy();
    }
    
    currentChart = new Chart(ctx, { 
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Target', data: targetData, backgroundColor: '#d9534f', borderColor: '#d9534f', borderWidth: 1 },
                { label: 'Sales', data: salesData, backgroundColor: '#5bc0de', borderColor: '#5bc0de', borderWidth: 1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Target vs Sales по Группам' },
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatNumber(c.raw)}` } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: formatNumber } }
            }
        }
    });
}

function renderTerritoryChart(aggregatedData) {
    const territoryChartContainer = document.getElementById('territoryChart'); // Убедитесь, что этот элемент есть в HTML
    if (!territoryChartContainer) return; 
    
    const ctx = territoryChartContainer.getContext('2d');

    if (currentTerritoryChart) { 
        currentTerritoryChart.destroy();
    }
    
    const labels = Object.keys(aggregatedData).sort();
    const salesData = labels.map(t => aggregatedData[t].sales);
    
    currentTerritoryChart = new Chart(ctx, { 
        type: 'doughnut', // Или 'bar', на ваше усмотрение
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Sales (USD)', 
                    data: salesData, 
                    backgroundColor: labels.map((_, i) => `hsl(${i * 30}, 70%, 50%)`), // Разноцветные сегменты
                    hoverOffset: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: { display: true, text: 'Разбивка Sales по Территориям' },
                legend: { position: 'right' },
                tooltip: { callbacks: { label: (c) => `${c.label}: ${formatNumber(c.raw)}` } }
            }
        }
    });
}

// ======================================================================================
// === ИНИЦИАЛИЗАЦИЯ ===
// ======================================================================================

document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    document.getElementById('last-update').textContent = now.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    fetchData();
});

async function fetchData() {
    // ... (код проверки URL и fetch остается прежним) ...
    
    if (TARGET_CSV_URL.includes('ВАШ_АКТУАЛЬНЫЙ_TARGET_URL') || SALES_CSV_URL.includes('ВАШ_АКТУАЛЬНЫЙ_SALES_URL')) {
        console.error('Критическая ошибка: Обновите URL-адреса Google Sheets в script.js, используя свежие ссылки.');
        alert('Критическая ошибка: Обновите URL-адреса в файле script.js.');
        return;
    }

    try {
        console.log('Начало загрузки данных с Google...');

        const [targetResponse, salesResponse] = await Promise.all([
            fetch(TARGET_CSV_URL),
            fetch(SALES_CSV_URL)
        ]);
        
        if (!targetResponse.ok || !salesResponse.ok) {
            const status = !targetResponse.ok ? targetResponse.status : salesResponse.status;
            console.error(`КРИТИЧЕСКАЯ ОШИБКА СЕТИ. Статус: ${status}.`);
            alert(`Ошибка! Статус ${status}. Пожалуйста, ПОВТОРНО ОПУБЛИКУЙТЕ CSV-файлы в Google Sheets.`);
            return;
        }

        const targetCSV = await targetResponse.text();
        const salesCSV = await salesResponse.text();
        
        // Получаем ДЕТАЛЬНЫЕ данные
        const targets = parseTargetCSV(targetCSV);
        const sales = parseSalesCSV(salesCSV);

        allCombinedData = combineData(targets, sales); // Объединяем и агрегируем
        generateFilterButtons(allCombinedData); // Генерируем кнопки
        processData(allCombinedData); // Изначально отображаем все данные

    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА FETCH/ПАРСИНГА:', error);
        alert(`Критическая ошибка! См. консоль разработчика (F12) для деталей.`);
    }
}

setInterval(fetchData, 60000);
