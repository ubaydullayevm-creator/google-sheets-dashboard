// ======================================================================================
// === ВАЖНО: Обновите эти две переменные, используя ПОЛНЫЕ ССЫЛКИ НА ОПУБЛИКОВАННЫЙ CSV ===
// ======================================================================================

// URL-адрес CSV для листа "Target" (должен быть получен через Файл -> Опубликовать в интернете)
const TARGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=1172056164&single=true&output=csv';

// URL-адрес CSV для листа "Лист16" (должен быть получен через Файл -> Опубликовать в интернете)
const SALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=407492630&single=true&output=csv';

let allCombinedData = {}; // Агрегированные данные по ГРУППАМ и allSalesDetails
let currentChart;         
let currentTerritoryChart; 
let selectedFilterGroup = 'All'; 


// ======================================================================================
// === ФУНКЦИИ ТОЧНОСТИ И ПАРСИНГА ЧИСЕЛ (Без изменений) ===
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

function roundToPrecision(num, precision = 12) {
    if (Math.abs(num) < 1e-10) return 0;
    const factor = Math.pow(10, precision);
    const correctedNum = Math.round(num * factor) / factor;
    const finalFactor = 100;
    return Math.round(correctedNum * finalFactor) / finalFactor; 
}


// ======================================================================================
// === ФОРМАТИРОВАНИЕ И КЛАССЫ (Без изменений) ===
// ======================================================================================

function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function formatPercent(num) {
    return new Intl.NumberFormat('ru-RU', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function getPercentClass(value) {
    if (value >= 1) return 'percent-good';
    if (value >= 0.85) return 'percent-ok';
    return 'percent-bad';
}


// ======================================================================================
// === ПАРСИНГ CSV (ОБНОВЛЕНО для возврата агрегации + деталей) ===
// ======================================================================================

function parseSalesCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedSales = {}; // Для объединения с таргетом
    const detailedSales = [];    // Для расчета Территорий

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        
        if (row.length < 5) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));

        const rawGroup = cleanRow[1] || '';
        const group = cleanGroup(rawGroup);
        const territory = cleanRow[2] || 'Не определено'; // <-- ПОЛЕ ПАРЕНТ / ТЕРРИТОРИЯ
        const usdValueString = cleanRow[4] || ''; 
        
        if (usdValueString.trim() === '') continue;
        
        let usdValue = cleanAndParseNumber(usdValueString); 
        const key = group === '' ? 'UNGROUPED_SALES' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            // 1. Агрегация (Для блока Групп)
            let currentSum = aggregatedSales[key] || 0;
            aggregatedSales[key] = roundToPrecision(Number(currentSum) + Number(usdValue)); 

            // 2. Детализация (Для блока Территорий)
            detailedSales.push({
                Group: group,
                Sales: roundToPrecision(usdValue),
                Parent: territory
            });

        } else if (usdValueString.trim() !== '') {
            console.warn(`[ПАРСИНГ SALES] Пропущена нечисловая строка: Raw USD="${cleanRow[4]}".`);
        }
    }
    return { aggregatedSales, detailedSales };
}

function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedTarget = {}; // Только агрегация

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        
        if (row.length < 4) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));

        const rawGroup = cleanRow[2] || '';
        const group = cleanGroup(rawGroup);
        const usdValueString = cleanRow[3] || '';

        if (usdValueString.trim() === '') continue;

        let usdValue = cleanAndParseNumber(usdValueString); 
        const key = group === '' ? 'UNGROUPED_TARGET' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            let currentSum = aggregatedTarget[key] || 0;
            aggregatedTarget[key] = roundToPrecision(Number(currentSum) + Number(usdValue));
        } else if (usdValueString.trim() !== '') {
            console.warn(`[ПАРСИНГ TARGET] Пропущена нечисловая строка: Raw USD="${cleanRow[3]}".`);
        }
    }
    return aggregatedTarget;
}


// ======================================================================================
// === ОБЪЕДИНЕНИЕ И АГРЕГАЦИЯ ДАННЫХ (ОБНОВЛЕНО) ===
// ======================================================================================

function combineData(targets, salesAggregated, salesDetailed) {
    const combined = {};
    const allGroups = new Set([...Object.keys(targets), ...Object.keys(salesAggregated)]);

    allGroups.forEach(group => {
        if (group && group.trim() !== '') {
            combined[group] = {
                target: targets[group] || 0,
                sales: salesAggregated[group] || 0
            };
        }
    });

    // Сохраняем детальные данные продаж для расчета Территорий
    combined.allSalesDetails = salesDetailed;
    return combined;
}


// ======================================================================================
// === ЛОГИКА ТЕРРИТОРИЙ (НОВЫЙ БЛОК) ===
// ======================================================================================

function aggregateDataByTerritory(dataDetails) {
    const aggregated = {};
    
    dataDetails.forEach(detail => {
        const territory = detail.Parent || 'Не определено';
        const sales = detail.Sales;
        
        if (!aggregated[territory]) {
            aggregated[territory] = { target: 0, sales: 0 };
        }
        
        aggregated[territory].sales = roundToPrecision(aggregated[territory].sales + sales);
        // Target остается 0, так как у нас нет данных Target по территориям
    });
    
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
    
    renderTerritoryChart(aggregatedData);
}

// ======================================================================================
// === ОСНОВНАЯ ЛОГИКА И ВЫВОД (ОБНОВЛЕНО) ===
// ======================================================================================

function processData(combinedData) {
    
    // 1. Фильтрация данных по ГРУППАМ и подготовка к выводу
    let filteredGroupData = {};
    if (selectedFilterGroup === 'All') {
        // Копируем все группы, кроме allSalesDetails
        Object.keys(combinedData).forEach(key => {
            if (key !== 'allSalesDetails') {
                filteredGroupData[key] = combinedData[key];
            }
        });
    } else {
        // Фильтруем по одной выбранной группе
        if (combinedData[selectedFilterGroup]) {
            filteredGroupData[selectedFilterGroup] = combinedData[selectedFilterGroup];
        }
    }
    
    // 2. Отображение Групп (используем ВАШУ оригинальную логику вывода)
    let totalTarget = 0; 
    let totalSales = 0;   
    let tableBody = document.getElementById('data-table-body');
    tableBody.innerHTML = '';
    const chartLabels = [];
    const chartTargets = [];
    const chartSales = [];
    
    const groupsToProcess = {};
    Object.keys(filteredGroupData).forEach(key => {
        const groupKey = key.toUpperCase();
        if (groupKey !== 'TIER' && !groupKey.startsWith('UNGROUPED')) {
            groupsToProcess[key] = filteredGroupData[key];
        }
    });

    const sortedGroups = Object.keys(groupsToProcess).sort((a, b) => {
        return groupsToProcess[b].target - groupsToProcess[a].target;
    });

    for (const group of sortedGroups) {
        const item = groupsToProcess[group];
        const target = Number(item.target) || 0; 
        const sales = Number(item.sales) || 0;     
        
        totalTarget = roundToPrecision(totalTarget + target);
        totalSales = roundToPrecision(totalSales + sales);

        const roundedTarget = Math.round(target); 
        const roundedSales = Math.round(sales);     
        
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
    
    // Обновление KPI и футера (ГРУППЫ)
    const totalExecution = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    const displayTotalTarget = Math.round(totalTarget);
    const displayTotalSales = Math.round(totalSales);
    const displayTotalDifference = displayTotalTarget - displayTotalSales;
    const totalExecutionClass = getPercentClass(totalExecution);

    document.getElementById('total-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('total-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('total-percent').textContent = formatPercent(totalExecution);
    document.getElementById('total-percent').className = `kpi-percent ${totalExecutionClass}`;
    
    document.getElementById('footer-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('footer-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('footer-percent').className = totalExecutionClass;
    document.getElementById('footer-diff').textContent = formatNumber(displayTotalDifference);

    renderChart(chartLabels, chartTargets, chartSales);
    
    // 3. Фильтрация и отображение Территорий
    let filteredSalesDetails = combinedData.allSalesDetails;
    if (selectedFilterGroup !== 'All') {
        // Фильтруем детальные продажи, чтобы показать только продажи выбранной группы
        filteredSalesDetails = combinedData.allSalesDetails.filter(detail => detail.Group === selectedFilterGroup);
    }

    const { aggregated: territoryAggregated, totalTarget: territoryTotalTarget, totalSales: territoryTotalSales } = aggregateDataByTerritory(filteredSalesDetails);
    displayTerritoryData(territoryAggregated, territoryTotalTarget, territoryTotalSales);

}

// ======================================================================================
// === ЛОГИКА ФИЛЬТРОВ И ГРАФИКОВ (Без изменений) ===
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
        if (groupKey !== 'TIER' && !groupKey.startsWith('UNGROUPED') && groupKey !== 'ALLSALESDETAILS') {
            groups.add(group);
        }
    });

    const allButton = document.createElement('button');
    allButton.textContent = 'All';
    allButton.classList.add('filter-button', 'all-button');
    if (selectedFilterGroup === 'All') allButton.classList.add('active');
    allButton.addEventListener('click', () => {
        selectedFilterGroup = 'All';
        updateFilterButtons();
        processData(allCombinedData);
    });
    filterContainer.appendChild(allButton);

    Array.from(groups).sort().forEach(group => {
        const button = document.createElement('button');
        button.textContent = group;
        button.classList.add('filter-button');
        if (selectedFilterGroup === group) button.classList.add('active');
        button.addEventListener('click', () => {
            selectedFilterGroup = group;
            updateFilterButtons();
            
            // Передаем весь объект allCombinedData, а фильтрация произойдет в processData
            processData(allCombinedData);
        });
        filterContainer.appendChild(button);
    });
}

function renderChart(labels, targetData, salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (currentChart) { currentChart.destroy(); }
    
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
            scales: { y: { beginAtZero: true, ticks: { callback: formatNumber } } }
        }
    });
}

function renderTerritoryChart(aggregatedData) {
    const territoryChartContainer = document.getElementById('territoryChart'); 
    if (!territoryChartContainer) return; 
    
    const ctx = territoryChartContainer.getContext('2d');

    if (currentTerritoryChart) { currentTerritoryChart.destroy(); }
    
    const labels = Object.keys(aggregatedData).sort();
    const salesData = labels.map(t => aggregatedData[t].sales);
    
    currentTerritoryChart = new Chart(ctx, { 
        type: 'doughnut', 
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Sales (USD)', 
                    data: salesData, 
                    backgroundColor: labels.map((_, i) => `hsl(${i * 30 % 360}, 70%, 50%)`),
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
        
        const targets = parseTargetCSV(targetCSV);
        const { aggregatedSales, detailedSales } = parseSalesCSV(salesCSV); // Получаем оба результата
        
        allCombinedData = combineData(targets, aggregatedSales, detailedSales); // Передаем детали продаж
        
        generateFilterButtons(allCombinedData);
        processData(allCombinedData);

    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА FETCH/ПАРСИНГА:', error);
        alert(`Критическая ошибка! См. консоль разработчика (F12) для деталей.`);
    }
}

setInterval(fetchData, 60000);
