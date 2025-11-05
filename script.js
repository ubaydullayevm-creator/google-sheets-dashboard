// ======================================================================================
// === ВАЖНО: Обновите эти две переменные, используя ПОЛНЫЕ ССЫЛКИ НА ОПУБЛИКОВАННЫЙ CSV ===
// ======================================================================================

// URL-адрес CSV для листа "Target" (должен быть получен через Файл -> Опубликовать в интернете)
const TARGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=1172056164&single=true&output=csv';

// URL-адрес CSV для листа "Лист16" (должен быть получен через Файл -> Опубликовать в интернете)
const SALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=407492630&single=true&output=csv';

let allCombinedData = {};
let currentChart = null;
let currentTerritoryChart = null;
let selectedFilterGroup = 'All';


// ======================================================================================
// === ФУНКЦИИ ТОЧНОСТИ И ПАРСИНГА ЧИСЕЛ (Оставляем как есть) ===
// ======================================================================================

/** Очистка имени группы */
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

/** Очистка и парсинг числа из строки CSV */
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
        if (cleaned.includes('.') && cleaned.indexOf(',') < cleaned.indexOf('.')) {
            cleaned = cleaned.replace(/\./g, '');
            cleaned = cleaned.replace(',', '.');
        } else if (!cleaned.includes('.')) {
             cleaned = cleaned.replace(',', '.');
        }
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? NaN : num;
}

/** Округление для избежания ошибок с плавающей точкой */
function roundToPrecision(num, precision = 2) {
    if (Math.abs(num) < 1e-10) return 0;
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
}


// ======================================================================================
// === ФОРМАТИРОВАНИЕ И КЛАССЫ (Отображение) ===
// ======================================================================================

/** Форматирование числа для отображения (целые числа, русское форматирование) */
function formatNumber(num) {
    const roundedNum = Math.round(num);
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(roundedNum);
}

/** Форматирование процента (два знака после запятой) */
function formatPercent(num) {
    if (isNaN(num) || num === Infinity) return '0,00 %';
    return new Intl.NumberFormat('ru-RU', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

/** Определение класса для светофора */
function getPercentClass(value) {
    if (value >= 1) return 'percent-good';
    if (value >= 0.85) return 'percent-ok';
    return 'percent-bad';
}


// ======================================================================================
// === ПАРСИНГ CSV (ИСПРАВЛЕНЫ ИНДЕКСЫ ПАРЕНТОВ) ===
// ======================================================================================

function parseSalesCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedSales = {};
    const detailedSales = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const row = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || line.split(',');

        // Убеждаемся, что строка имеет достаточную длину (минимум 5 колонок)
        if (row.length < 5) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));
        
        // SALES CSV: 
        // 0 - Дата, 1 - Группа/Продукт (используется для Групп), 2 - ТЕРРИТОРИЯ (новое предположение), 3 - ???, 4 - Sales USD 
        
        const rawGroup = cleanRow[1] || '';
        const group = cleanGroup(rawGroup);
        
        // !!! ИСПРАВЛЕНИЕ: Территория (Парент) берется из колонки 3 (индекс 2)
        const territory = cleanRow[2] || 'Не определено'; // <--- ИЗМЕНЕНИЕ ИНДЕКСА
        
        const usdValueString = cleanRow[4] || ''; // Оставляем Sales USD в колонке 5 (индекс 4)

        if (usdValueString.trim() === '') continue;

        let usdValue = cleanAndParseNumber(usdValueString);
        const key = group === '' ? 'UNGROUPED_SALES' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            usdValue = roundToPrecision(usdValue);

            let currentSum = aggregatedSales[key] || 0;
            aggregatedSales[key] = roundToPrecision(Number(currentSum) + Number(usdValue));

            detailedSales.push({
                Group: group,
                Sales: usdValue,
                Parent: territory // Используем индекс 2 для Территории
            });
        }
    }
    return { aggregatedSales, detailedSales };
}

// ... (Весь остальной код остается как в предыдущем ответе)

// ... (Весь остальной код остается как в предыдущем ответе)

/** ИСПРАВЛЕНИЕ: Корректное определение колонок Target CSV */
function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedTargetByGroup = {};
    const aggregatedTargetByParent = {}; 

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const row = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || line.split(',');

        if (row.length < 4) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));
        
        // TARGET CSV: 
        // 0 - Парент (Территория), 1 - Class (Канал), 2 - Группа, 3 - Target USD
        
        // ИСПРАВЛЕНИЕ 1: Парент берется из колонки 1 (индекс 0) и НЕ очищается cleanGroup
        const rawParent = cleanRow[0] || ''; 
        const parent = rawParent.trim();
        
        const rawGroup = cleanRow[2] || '';
        const group = cleanGroup(rawGroup);
        const usdValueString = cleanRow[3] || '';

        if (usdValueString.trim() === '') continue;

        let usdValue = cleanAndParseNumber(usdValueString);
        
        if (!isNaN(usdValue) && usdValue !== 0) {
            usdValue = roundToPrecision(usdValue);
            
            // 1. Агрегация по Группе (для верхней таблицы - старая логика)
            const keyGroup = group === '' ? 'UNGROUPED_TARGET' : group;
            let currentSumGroup = aggregatedTargetByGroup[keyGroup] || 0;
            aggregatedTargetByGroup[keyGroup] = roundToPrecision(Number(currentSumGroup) + Number(usdValue));

            // 2. Агрегация по Паренту (для нижней таблицы)
            if (parent !== '' && parent !== 'Не определено') {
                let currentSumParent = aggregatedTargetByParent[parent] || 0;
                aggregatedTargetByParent[parent] = roundToPrecision(Number(currentSumParent) + Number(usdValue));
            }
        }
    }
    return { targetsByGroup: aggregatedTargetByGroup, targetsByParent: aggregatedTargetByParent };
}


// ======================================================================================
// === ОБЪЕДИНЕНИЕ ДАННЫХ И ЛОГИКА ТЕРРИТОРИЙ (Оставляем как есть) ===
// ======================================================================================

function combineData(targetsByGroup, targetsByParent, salesAggregated, salesDetailed) {
    const combined = {};
    const allGroups = new Set([...Object.keys(targetsByGroup), ...Object.keys(salesAggregated)]);

    allGroups.forEach(group => {
        if (group && group.trim() !== '' && !group.startsWith('UNGROUPED')) {
            combined[group] = {
                target: targetsByGroup[group] || 0,
                sales: salesAggregated[group] || 0
            };
        }
    });

    combined.allSalesDetails = salesDetailed;
    combined.allParentTargets = targetsByParent; 
    return combined;
}

/** Агрегация данных по Территориям теперь использует Targets по Парентам */
function aggregateDataByTerritory(dataDetails, combinedData) {
    const aggregated = {};
    const parentTargets = combinedData.allParentTargets || {}; 

    // Шаг 1: Агрегация Sales по Territory и присвоение Target по Паренту
    dataDetails.forEach(detail => {
        const territory = detail.Parent || 'Не определено';
        const sales = detail.Sales;
        
        if (!aggregated[territory]) {
            const target = parentTargets[territory] || 0; 
            aggregated[territory] = { target: target, sales: 0 };
        }

        aggregated[territory].sales = roundToPrecision(aggregated[territory].sales + sales);
    });
    
    // Добавляем Парентов, у которых есть Target, но нет продаж в текущем фильтре.
    if (selectedFilterGroup === 'All') {
        Object.keys(parentTargets).forEach(territory => {
            if (!aggregated[territory]) {
                aggregated[territory] = { target: parentTargets[territory], sales: 0 };
            }
        });
    }

    // Шаг 2: Пересчет общих итогов
    // Total Target для Territories (нижний KPI) берется из общей суммы Targets Групп (верхней таблицы)
    let totalTarget = 0;
    Object.keys(combinedData).forEach(key => {
        if (key !== 'allSalesDetails' && key !== 'allParentTargets') {
             totalTarget = roundToPrecision(totalTarget + (combinedData[key].target || 0));
        }
    });

    // Total Sales агрегируется правильно
    let totalSales = Object.values(aggregated).reduce((sum, item) => sum + item.sales, 0);

    return { aggregated, totalTarget: roundToPrecision(totalTarget), totalSales: roundToPrecision(totalSales) };
}


// ======================================================================================
// === ОТОБРАЖЕНИЕ ДАННЫХ (Оставляем как есть) ===
// ======================================================================================

/** Отображение данных по Группам (Оставляем как есть) */
function displayGroupData(filteredGroupData) {
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
        if (groupKey !== 'TIER' && !groupKey.startsWith('UNGROUPED') && groupKey !== 'ALLSALESDETAILS' && groupKey !== 'ALLPARENTTARGETS') {
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
        chartTargets.push(roundedTarget);
        chartSales.push(roundedSales);
    }

    // Обновление KPI и футера (ГРУППЫ)
    const totalExecution = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    const displayTotalTarget = Math.round(totalTarget);
    const displayTotalSales = Math.round(totalSales);
    const displayTotalDifference = displayTotalTarget - displayTotalSales;
    const totalExecutionClass = getPercentClass(totalExecution);

    // KPI
    document.getElementById('total-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('total-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('total-percent').textContent = formatPercent(totalExecution);
    document.getElementById('total-percent').className = `kpi-percent ${totalExecutionClass}`;
    // Footer
    document.getElementById('footer-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('footer-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('footer-percent').className = `align-right ${totalExecutionClass}`;
    document.getElementById('footer-diff').textContent = formatNumber(displayTotalDifference);

    const kpiSalesParent = document.getElementById('total-percent').closest('.kpi-card');
    if(kpiSalesParent) {
        kpiSalesParent.style.borderColor = totalExecutionClass === 'percent-good' ? '#5cb85c' : totalExecutionClass === 'percent-ok' ? '#f0ad4e' : '#d9534f';
    }

    renderChart(chartLabels, chartTargets, chartSales);
}


/** Отображение данных по Территориям теперь использует Target для расчета */
function displayTerritoryData(aggregatedData, totalTarget, totalSales) {
    const tbody = document.getElementById('territory-data-table-body');
    tbody.innerHTML = '';

    // Сортировка по убыванию продаж
    const sortedTerritories = Object.keys(aggregatedData).sort((a, b) => {
        // Сортировка по Target, если Sales одинаковы
        if (aggregatedData[b].sales === aggregatedData[a].sales) {
            return aggregatedData[b].target - aggregatedData[a].target;
        }
        return aggregatedData[b].sales - aggregatedData[a].sales;
    });
    
    // Пересчет итогов для футера (это итоги по отфильтрованной/агрегированной таблице)
    let totalTargetTable = 0;
    let totalSalesTable = 0;

    sortedTerritories.forEach(territory => {
        const data = aggregatedData[territory];

        const target = Math.round(data.target) || 0;
        const sales = Math.round(data.sales);
        
        totalTargetTable += target;
        totalSalesTable += sales;

        const execution = (target === 0) ? 0 : roundToPrecision(sales / target);
        const difference = roundToPrecision(target - sales);

        const percentClass = getPercentClass(execution);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${territory}</td>
            <td class="align-right">${formatNumber(target)}</td>
            <td class="align-right">${formatNumber(sales)}</td>
            <td class="align-right ${percentClass}">${formatPercent(execution)}</td> 
            <td class="align-right">${formatNumber(Math.round(difference))}</td>
        `;
        tbody.appendChild(row);
    });

    // Общие итоги в футере таблицы и KPI (РАСЧЕТ ВЕРЕН)
    const totalExecutionKPI = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    const totalExecutionClassKPI = getPercentClass(totalExecutionKPI);
    const displayTotalTargetKPI = Math.round(totalTarget);
    const displayTotalSalesKPI = Math.round(totalSales);
    const displayTotalDifferenceKPI = displayTotalTargetKPI - displayTotalSalesKPI;

    // Обновление футера (используем итоги по таблице)
    const totalExecutionTable = (totalTargetTable === 0) ? 0 : roundToPrecision(totalSalesTable / totalTargetTable);
    const totalExecutionClassTable = getPercentClass(totalExecutionTable);
    const displayTotalDifferenceTable = totalTargetTable - totalSalesTable;
    
    // Обновление футера
    document.getElementById('territory-footer-target').textContent = formatNumber(totalTargetTable);
    document.getElementById('territory-footer-sales').textContent = formatNumber(totalSalesTable);
    document.getElementById('territory-footer-percent').textContent = formatPercent(totalExecutionTable);
    document.getElementById('territory-footer-percent').className = `align-right ${totalExecutionClassTable}`;
    document.getElementById('territory-footer-diff').textContent = formatNumber(displayTotalDifferenceTable);

    // Обновление KPI (используем общие итоги Групп)
    document.getElementById('territory-total-target').textContent = formatNumber(displayTotalTargetKPI);
    document.getElementById('territory-total-sales').textContent = formatNumber(displayTotalSalesKPI);
    document.getElementById('territory-total-percent').textContent = formatPercent(totalExecutionKPI);
    document.getElementById('territory-total-percent').className = `kpi-percent ${totalExecutionClassKPI}`;

    const kpiParent = document.getElementById('territory-total-percent').closest('.kpi-card');
    if(kpiParent) {
        kpiParent.style.borderColor = totalExecutionClassKPI === 'percent-good' ? '#5cb85c' : totalExecutionClassKPI === 'percent-ok' ? '#f0ad4e' : '#d9534f';
    }

    renderTerritoryChart(aggregatedData);
}


// ======================================================================================
// === ЛОГИКА ФИЛЬТРОВ И ГРАФИКОВ (Оставляем как есть) ===
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
        if (groupKey !== 'TIER' && !groupKey.startsWith('UNGROUPED') && groupKey !== 'ALLSALESDETAILS' && groupKey !== 'ALLPARENTTARGETS') {
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
        updateDashboard(allCombinedData);
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
            updateDashboard(allCombinedData);
        });
        filterContainer.appendChild(button);
    });
}

/** Рендеринг графика для Групп */
function renderChart(labels, targetData, salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (currentChart) { currentChart.destroy(); }

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Target', data: targetData, backgroundColor: '#dc3545', borderColor: '#dc3545', borderWidth: 1 },
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
            scales: { y: { beginAtZero: true, ticks: { callback: (value) => formatNumber(value) } } }
        }
    });
}

/** Рендеринг графика для Территорий */
function renderTerritoryChart(aggregatedData) {
    const territoryChartContainer = document.getElementById('territoryChart');
    if (!territoryChartContainer) return;

    const ctx = territoryChartContainer.getContext('2d');

    if (currentTerritoryChart) { currentTerritoryChart.destroy(); }

    const labels = Object.keys(aggregatedData).sort();
    const salesData = labels.map(t => Math.round(aggregatedData[t].sales));

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
// === ОСНОВНОЙ КОНТРОЛЛЕР И ИНИЦИАЛИЗАЦИЯ (Оставляем как есть, но использует новый combinedData) ===
// ======================================================================================

/** Обновление дашборда после загрузки или фильтрации */
function updateDashboard(combinedData) {

    // 1. Подготовка данных для Групп
    let filteredGroupData = {};
    if (selectedFilterGroup === 'All') {
        Object.keys(combinedData).forEach(key => {
            if (key !== 'allSalesDetails' && key !== 'allParentTargets') { // Исключаем новый ключ
                filteredGroupData[key] = combinedData[key];
            }
        });
    } else {
        if (combinedData[selectedFilterGroup]) {
            filteredGroupData[selectedFilterGroup] = combinedData[selectedFilterGroup];
        }
    }

    // 2. Отображение Групп и графиков
    displayGroupData(filteredGroupData);


    // 3. Фильтрация и агрегация Территорий
    let filteredSalesDetails = combinedData.allSalesDetails;
    if (selectedFilterGroup !== 'All') {
        filteredSalesDetails = combinedData.allSalesDetails.filter(detail => detail.Group === selectedFilterGroup);
    }

    // В aggregateDataByTerritory нам нужно передать allCombinedData для получения Total Target и Parent Targets
    const { aggregated: territoryAggregated, totalTarget: territoryTotalTarget, totalSales: territoryTotalSales } = aggregateDataByTerritory(filteredSalesDetails, allCombinedData);

    // 4. Отображение Территорий
    displayTerritoryData(territoryAggregated, territoryTotalTarget, territoryTotalSales);

    // Обновление времени
    document.getElementById('last-update').textContent = new Date().toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}


/** Функция загрузки данных по двум URL */
async function fetchData() {
    try {
        const [targetResponse, salesResponse] = await Promise.all([
            fetch(TARGET_CSV_URL),
            fetch(SALES_CSV_URL)
        ]);

        if (!targetResponse.ok || !salesResponse.ok) {
            throw new Error(`Ошибка сети: Target Status: ${targetResponse.status}, Sales Status: ${salesResponse.status}`);
        }

        const targetCSV = await targetResponse.text();
        const salesCSV = await salesResponse.text();

        const { targetsByGroup, targetsByParent } = parseTargetCSV(targetCSV); 
        const { aggregatedSales, detailedSales } = parseSalesCSV(salesCSV);

        allCombinedData = combineData(targetsByGroup, targetsByParent, aggregatedSales, detailedSales); 

        generateFilterButtons(allCombinedData);
        updateDashboard(allCombinedData);

    } catch (error) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА ЗАГРУЗКИ ИЛИ ПАРСИНГА:", error);
        document.getElementById('last-update').textContent = `ОШИБКА: Не удалось загрузить данные. Проверьте URL CSV и CORS.`;
    }
}


// ======================================================================================
// === ЗАПУСК ===
// ======================================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('last-update').textContent = new Date().toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    fetchData();
});

// Автоматическое обновление данных каждые 60 секунд
setInterval(fetchData, 60000);
