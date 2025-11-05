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
// === ФУНКЦИИ ТОЧНОСТИ И ПАРСИНГА ЧИСЕЛ ===
// ======================================================================================

/** Очистка имени группы (берет первые 2-3 заглавные буквы) */
function cleanGroup(rawGroup) {
    if (typeof rawGroup !== 'string') return '';
    const match = rawGroup.trim().toUpperCase().match(/[A-Z]{2,3}/); 
    if (match) {
        // Мы берем ТОЛЬКО первые 2 или 3 заглавные буквы, чтобы получить IN, NCF, CNF и т.д.
        return match[0].substring(0, 3);
    }
    return '';
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
    // ИСПРАВЛЕНИЕ: Если выполнение невозможно (Target=0) или ошибка, выводим Н/Д
    if (isNaN(num) || num === Infinity) return 'Н/Д';
    return new Intl.NumberFormat('ru-RU', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num / 100);
}

/** Определение класса для светофора */
function getPercentClass(value) {
    // Value теперь от 0 до 1, так как в расчетах мы делим sales/target
    if (value >= 1) return 'percent-good';
    if (value >= 0.85) return 'percent-ok';
    return 'percent-bad';
}


// ======================================================================================
// === ПАРСИНГ CSV (КЛЮЧЕВЫЕ ИСПРАВЛЕНИЯ) ===
// ======================================================================================

// --- ФУНКЦИЯ ПАРСИНГА TARGET CSV ---
function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const targetsByGroup = {};
    const targetsByProduct = {}; // Для нижней таблицы (Target по продукту)

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const row = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || line.split(',');

        if (row.length < 4) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));
        
        // Target CSV: 0 - Парент/Продукт, 1 - Class, 2 - Group, 3 - USD (Target)
        const rawProduct = cleanRow[0] || ''; // Парент (Продукт/Товар)
        const rawGroup = cleanRow[2] || '';  // Группа
        const usdValueString = cleanRow[3] || ''; // Target USD

        if (usdValueString.trim() === '') continue;

        let usdValue = cleanAndParseNumber(usdValueString);
        // Используем очистку, чтобы получить IN, NCF, CNF и т.д.
        const group = cleanGroup(rawGroup); 
        const keyGroup = group === '' ? 'UNGROUPED_TARGET' : group;
        const keyProduct = rawProduct.trim() || 'Не определено (Продукт)';

        if (!isNaN(usdValue) && usdValue !== 0) {
            usdValue = roundToPrecision(usdValue);

            // 1. Агрегация по Группе (для верхней таблицы)
            let currentSumGroup = targetsByGroup[keyGroup] || 0;
            targetsByGroup[keyGroup] = roundToPrecision(Number(currentSumGroup) + Number(usdValue));

            // 2. Агрегация по Продукту (для нижней таблицы)
            targetsByProduct[keyProduct] = {
                target: roundToPrecision((targetsByProduct[keyProduct]?.target || 0) + usdValue),
                group: keyGroup // Сохраняем группу для фильтрации
            };
        }
    }
    return { targetsByGroup, targetsByProduct };
}

// --- ФУНКЦИЯ ПАРСИНГА SALES CSV ---
function parseSalesCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedSales = {};
    const detailedSales = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const row = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || line.split(',');

        if (row.length < 5) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));
        
        // SALES CSV: 
        // 0 - Дата/Канал, 1 - Группа/Продукт, 2 - ???, 3 - ???, 4 - Sales USD
        
        const rawGroupAndProduct = cleanRow[1] || ''; // Содержит и Группу, и Продукт
        
        // 1. Извлекаем чистую Группу (IN, NCF, CNF) для агрегации в верхней таблице
        const group = cleanGroup(rawGroupAndProduct); 
        
        // ИСПРАВЛЕНИЕ: Используем ПОЛНОЕ название из колонки 1 как Продукт для детализации
        const productDetail = rawGroupAndProduct.trim() || 'Не определено'; 
        
        const usdValueString = cleanRow[4] || ''; // Sales USD оставлен в колонке 5 (индекс 4)

        if (usdValueString.trim() === '') continue;

        let usdValue = cleanAndParseNumber(usdValueString);
        const key = group === '' ? 'UNGROUPED_SALES' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            usdValue = roundToPrecision(usdValue);

            // 1. Агрегация для верхней таблицы (по ЧИСТОЙ Группе)
            let currentSumGroup = aggregatedSales[key] || 0;
            aggregatedSales[key] = roundToPrecision(Number(currentSumGroup) + Number(usdValue));

            // 2. Детализация для нижней таблицы (по Продукту)
            detailedSales.push({
                Group: group, // Чистая группа для фильтрации
                Sales: usdValue,
                Product: productDetail // Название товара/парент
            });
        }
    }
    return { aggregatedSales, detailedSales };
}


// ======================================================================================
// === ОБЪЕДИНЕНИЕ ДАННЫХ И ЛОГИКА ТЕРРИТОРИЙ/ПРОДУКТОВ ===
// ======================================================================================

function combineData(targetsByGroup, targetsByProduct, salesAggregated, salesDetailed) {
    const combined = {};
    // Объединяем ВСЕ чистые группы, найденные в Target и Sales
    const allGroups = new Set([...Object.keys(targetsByGroup), ...Object.keys(salesAggregated)]);

    allGroups.forEach(group => {
        // Исключаем временные UNGROUPED_...
        if (group && group.trim() !== '' && !group.startsWith('UNGROUPED')) {
            combined[group] = {
                target: targetsByGroup[group] || 0,
                sales: salesAggregated[group] || 0
            };
        }
    });

    combined.allSalesDetails = salesDetailed;
    combined.allProductTargets = targetsByProduct; // Target по Продуктам
    return combined;
}

/** Агрегация данных по Продуктам (называемым 'Территория' в таблице) */
function aggregateDataByProduct(dataDetails, combinedData) {
    const aggregatedSales = {};
    const productTargets = combinedData.allProductTargets || {}; 

    // Шаг 1: Агрегация Sales по Продуктам
    dataDetails.forEach(detail => {
        const product = detail.Product || 'Не определено';
        const sales = detail.Sales;
        
        if (!aggregatedSales[product]) {
            aggregatedSales[product] = { sales: 0 };
        }

        aggregatedSales[product].sales = roundToPrecision(aggregatedSales[product].sales + sales);
    });

    // Шаг 2: Объединение с Targets и финальная агрегация
    const finalAggregated = {};
    const allProducts = new Set([...Object.keys(aggregatedSales), ...Object.keys(productTargets)]);

    allProducts.forEach(product => {
        const targetData = productTargets[product] || { target: 0, group: '' };
        const salesData = aggregatedSales[product] || { sales: 0 };

        // Исключаем пустые элементы, где нет ни Sales, ни Target
        if (salesData.sales > 0 || targetData.target > 0) {
            // Для фильтрации по Группе
            const groupMatch = dataDetails.length > 0 ? dataDetails[0].Group : targetData.group; 

            finalAggregated[product] = {
                target: targetData.target,
                sales: salesData.sales,
                group: groupMatch
            };
        }
    });

    // Шаг 3: Пересчет общих итогов (Берем из общих итогов Групп)
    let totalTarget = 0;
    let totalSales = 0;

    Object.keys(combinedData).forEach(key => {
        if (key !== 'allSalesDetails' && key !== 'allProductTargets') {
             totalTarget = roundToPrecision(totalTarget + (combinedData[key].target || 0));
             totalSales = roundToPrecision(totalSales + (combinedData[key].sales || 0));
        }
    });

    return { 
        aggregated: finalAggregated, 
        totalTarget: roundToPrecision(totalTarget), 
        totalSales: roundToPrecision(totalSales) 
    };
}


// ======================================================================================
// === ОТОБРАЖЕНИЕ ДАННЫХ ===
// ======================================================================================

/** Отображение данных по Группам */
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
        // Исключаем технические ключи
        if (key !== 'allSalesDetails' && key !== 'allProductTargets') { 
            groupsToProcess[key] = filteredGroupData[key];
        }
    });

    // Сортировка по Target
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
        // Для выполнения: если Target = 0, Execution = Н/Д. Иначе - расчет.
        const displayExecution = (target === 0) ? 'Н/Д' : formatPercent(execution * 100);
        const percentClass = getPercentClass(execution);

        row.innerHTML = `
            <td>${group}</td>
            <td class="align-right">${formatNumber(roundedTarget)}</td>
            <td class="align-right">${formatNumber(roundedSales)}</td>
            <td class="align-right ${percentClass}">${displayExecution}</td>
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
    document.getElementById('total-percent').textContent = formatPercent(totalExecution * 100);
    document.getElementById('total-percent').className = `kpi-percent ${totalExecutionClass}`;
    // Footer
    document.getElementById('footer-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('footer-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('footer-percent').textContent = formatPercent(totalExecution * 100);
    document.getElementById('footer-percent').className = `align-right ${totalExecutionClass}`;
    document.getElementById('footer-diff').textContent = formatNumber(displayTotalDifference);

    const kpiSalesParent = document.getElementById('total-percent').closest('.kpi-card');
    if(kpiSalesParent) {
        kpiSalesParent.style.borderColor = totalExecutionClass === 'percent-good' ? '#5cb85c' : totalExecutionClass === 'percent-ok' ? '#f0ad4e' : '#d9534f';
    }

    renderChart(chartLabels, chartTargets, chartSales);
}


/** Отображение данных по Продуктам (Территориям) */
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
    
    let totalTargetTable = 0;
    let totalSalesTable = 0;

    sortedTerritories.forEach(product => {
        const data = aggregatedData[product];

        const target = Math.round(data.target) || 0;
        const sales = Math.round(data.sales);
        
        totalTargetTable += target;
        totalSalesTable += sales;

        const execution = (target === 0) ? 0 : roundToPrecision(sales / target);
        const difference = roundToPrecision(target - sales);

        // Для выполнения: если Target = 0, Execution = Н/Д. Иначе - расчет.
        const displayExecution = (target === 0) ? 'Н/Д' : formatPercent(execution * 100);
        const percentClass = getPercentClass(execution);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product}</td>
            <td class="align-right">${formatNumber(target)}</td>
            <td class="align-right">${formatNumber(sales)}</td>
            <td class="align-right ${percentClass}">${displayExecution}</td> 
            <td class="align-right">${formatNumber(Math.round(difference))}</td>
        `;
        tbody.appendChild(row);
    });

    // Общие итоги в футере таблицы и KPI
    const totalExecutionKPI = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    const totalExecutionClassKPI = getPercentClass(totalExecutionKPI);
    const displayTotalTargetKPI = Math.round(totalTarget);
    const displayTotalSalesKPI = Math.round(totalSales);
    
    // Обновление футера (используем итоги по таблице)
    const totalExecutionTable = (totalTargetTable === 0) ? 0 : roundToPrecision(totalSalesTable / totalTargetTable);
    const totalExecutionClassTable = getPercentClass(totalExecutionTable);
    const displayTotalDifferenceTable = totalTargetTable - totalSalesTable;
    
    // Обновление футера
    document.getElementById('territory-footer-target').textContent = formatNumber(totalTargetTable);
    document.getElementById('territory-footer-sales').textContent = formatNumber(totalSalesTable);
    document.getElementById('territory-footer-percent').textContent = formatPercent(totalExecutionTable * 100);
    document.getElementById('territory-footer-percent').className = `align-right ${totalExecutionClassTable}`;
    document.getElementById('territory-footer-diff').textContent = formatNumber(displayTotalDifferenceTable);

    // Обновление KPI (используем общие итоги Групп)
    document.getElementById('territory-total-target').textContent = formatNumber(displayTotalTargetKPI);
    document.getElementById('territory-total-sales').textContent = formatNumber(displayTotalSalesKPI);
    document.getElementById('territory-total-percent').textContent = formatPercent(totalExecutionKPI * 100);
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
        // Исключаем технические ключи
        if (groupKey !== 'ALLSALESDETAILS' && groupKey !== 'ALLPRODUCTTARGETS') { 
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

/** Рендеринг графика для Продуктов (Территорий) */
function renderTerritoryChart(aggregatedData) {
    const territoryChartContainer = document.getElementById('territoryChart');
    if (!territoryChartContainer) return;

    const ctx = territoryChartContainer.getContext('2d');

    if (currentTerritoryChart) { currentTerritoryChart.destroy(); }

    // Исключаем элементы, у которых Sales = 0 для более чистого графика
    const filteredData = Object.entries(aggregatedData)
        .filter(([_, data]) => data.sales > 0 || data.target > 0)
        .sort((a, b) => (b[1].sales + b[1].target) - (a[1].sales + a[1].target));
        
    const labels = filteredData.map(item => item[0]);
    // Используем Sales для круговой диаграммы
    const salesData = filteredData.map(item => Math.round(item[1].sales)); 

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
                title: { display: true, text: 'Разбивка Sales по Продуктам' },
                legend: { position: 'right' },
                tooltip: { callbacks: { label: (c) => `${c.label}: ${formatNumber(c.raw)}` } }
            }
        }
    });
}


// ======================================================================================
// === ОСНОВНОЙ КОНТРОЛЛЕР И ИНИЦИАЛИЗАЦИЯ ===
// ======================================================================================

/** Обновление дашборда после загрузки или фильтрации */
function updateDashboard(combinedData) {

    // 1. Подготовка данных для Групп
    let filteredGroupData = {};
    Object.keys(combinedData).forEach(key => {
        // Все группы, кроме технических ключей, идут в верхнюю таблицу
        if (key !== 'allSalesDetails' && key !== 'allProductTargets') { 
            filteredGroupData[key] = combinedData[key];
        }
    });

    // 2. Отображение Групп и графиков
    displayGroupData(filteredGroupData);


    // 3. Фильтрация и агрегация Продуктов
    let filteredSalesDetails = combinedData.allSalesDetails;
    // Фильтруем детали продаж по выбранной Группе
    if (selectedFilterGroup !== 'All') {
        filteredSalesDetails = combinedData.allSalesDetails.filter(detail => detail.Group === selectedFilterGroup);
    }

    // 4. Агрегация по Продуктам
    // totalTarget и totalSales берутся из общей агрегации (combinedData)
    const { aggregated: productAggregated, totalTarget: productTotalTarget, totalSales: productTotalSales } = aggregateDataByProduct(filteredSalesDetails, allCombinedData);

    // 5. Отображение Продуктов
    displayTerritoryData(productAggregated, productTotalTarget, productTotalSales);

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

        // targetsByProduct теперь содержит Target по каждому продукту
        const { targetsByGroup, targetsByProduct } = parseTargetCSV(targetCSV); 
        const { aggregatedSales, detailedSales } = parseSalesCSV(salesCSV);

        allCombinedData = combineData(targetsByGroup, targetsByProduct, aggregatedSales, detailedSales); 

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
