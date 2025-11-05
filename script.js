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
// === ФУНКЦИИ ТОЧНОСТИ И ПАРСИНГА ЧИСЕЛ (Без изменений) ===
// ======================================================================================

/** Очистка имени группы (берет первые 2-3 заглавные буквы) */
function cleanGroup(rawGroup) {
    if (typeof rawGroup !== 'string') return '';
    const match = rawGroup.trim().toUpperCase().match(/[A-Z]{2,3}/); 
    if (match) {
        return match[0].substring(0, 3);
    }
    return '';
}

/** Очистка и парсинг числа из строки CSV (Без изменений) */
function cleanAndParseNumber(rawString) {
    // ... (остальной код)
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

/** Округление для избежания ошибок с плавающей точкой (Без изменений) */
function roundToPrecision(num, precision = 2) {
    if (Math.abs(num) < 1e-10) return 0;
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
}

// ... (Функции форматирования и классов)


// ======================================================================================
// === ПАРСИНГ CSV (КЛЮЧЕВОЕ: Собираем ТОЛЬКО уникальные ключи Парентов) ===
// ======================================================================================

// --- ФУНКЦИЯ ПАРСИНГА TARGET CSV ---
function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const targetsByGroup = {};
    const targetsByProduct = {}; 

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const row = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || line.split(',');

        if (row.length < 4) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));
        
        // Target CSV: 0 - Парент/Продукт, 2 - Group, 3 - USD (Target)
        const rawProduct = cleanRow[0] || ''; 
        const rawGroup = cleanRow[2] || ''; 
        const usdValueString = cleanRow[3] || ''; 

        if (usdValueString.trim() === '') continue;

        let usdValue = cleanAndParseNumber(usdValueString);
        const group = cleanGroup(rawGroup); 
        const keyGroup = group === '' ? 'UNGROUPED_TARGET' : group;
        const keyProduct = rawProduct.trim() || 'Не определено (Продукт)';

        if (!isNaN(usdValue) && usdValue !== 0) {
            usdValue = roundToPrecision(usdValue);

            // 1. Агрегация по Группе (для верхней таблицы)
            let currentSumGroup = targetsByGroup[keyGroup] || 0;
            targetsByGroup[keyGroup] = roundToPrecision(Number(currentSumGroup) + Number(usdValue));

            // 2. Агрегация по Продукту (для нижней таблицы). 
            // Мы просто собираем все, что есть в колонке Парента/Продукта
            targetsByProduct[keyProduct] = {
                target: roundToPrecision((targetsByProduct[keyProduct]?.target || 0) + usdValue),
                group: keyGroup
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
        
        // SALES CSV: Колонка 1 - Группа/Продукт
        // Колонка 4 - Sales USD
        
        const rawGroupAndProduct = cleanRow[1] || ''; 
        const usdValueString = cleanRow[4] || ''; 

        if (usdValueString.trim() === '') continue;

        let usdValue = cleanAndParseNumber(usdValueString);
        
        // 1. Агрегация по ГРУППЕ (для верхней таблицы)
        const group = cleanGroup(rawGroupAndProduct); 
        const key = group === '' ? 'UNGROUPED_SALES' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            usdValue = roundToPrecision(usdValue);

            // Агрегация для верхней таблицы (по ЧИСТОЙ Группе)
            let currentSumGroup = aggregatedSales[key] || 0;
            aggregatedSales[key] = roundToPrecision(Number(currentSumGroup) + Number(usdValue));

            // 2. Детализация для нижней таблицы (по Продукту/Паренту). 
            // Собираем ВСЕ продажи, т.к. фильтрация будет позже
            const productDetail = rawGroupAndProduct.trim() || 'Не определено'; 
            
            detailedSales.push({
                Group: group, 
                Sales: usdValue,
                Product: productDetail // Название товара/парент
            });
        }
    }
    return { aggregatedSales, detailedSales };
}


// ======================================================================================
// === ОБЪЕДИНЕНИЕ И ФИЛЬТРАЦИЯ (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Выбираем только Паренты) ===
// ======================================================================================

function combineData(targetsByGroup, targetsByProduct, salesAggregated, salesDetailed) {
    // ... (без изменений)
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
    combined.allProductTargets = targetsByProduct; 
    return combined;
}

/** Агрегация данных по Продуктам (называемым 'Территория' в таблице) */
function aggregateDataByProduct(dataDetails, combinedData) {
    const aggregatedSales = {};
    const productTargets = combinedData.allProductTargets || {}; 

    // Шаг 1: Агрегация Sales по Продуктам
    // Сюда попадают и группы, и паренты, и даты, которые были в Sales CSV
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
    
    // 🚨 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: МЫ БЕРЕМ КЛЮЧИ ТОЛЬКО ИЗ TARGET CSV (Паренты)
    const allProducts = Object.keys(productTargets); 

    allProducts.forEach(product => {
        const targetData = productTargets[product] || { target: 0, group: '' };
        const salesData = aggregatedSales[product] || { sales: 0 };
        
        // Включаем только те Паренты, для которых есть Target ИЛИ Sales (после агрегации)
        if (targetData.target > 0 || salesData.sales > 0) { 
            let groupMatch = targetData.group; 
            if (dataDetails.length > 0) {
                 const salesDetailMatch = dataDetails.find(d => d.Product === product);
                 if (salesDetailMatch) groupMatch = salesDetailMatch.Group;
            }

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
// === ОТОБРАЖЕНИЕ И УПРАВЛЕНИЕ (опущено для краткости) ===
// ======================================================================================

function displayGroupData(filteredGroupData) { /* ... */ }
function displayTerritoryData(aggregatedData, totalTarget, totalSales) { /* ... */ }
function updateFilterButtons() { /* ... */ }
function generateFilterButtons(data) { /* ... */ }
function renderChart(labels, targetData, salesData) { /* ... */ }
function renderTerritoryChart(aggregatedData) { /* ... */ }
function updateDashboard(combinedData) { /* ... */ }
async function fetchData() { /* ... */ }


document.addEventListener('DOMContentLoaded', () => {
    // ... (запуск)
    fetchData();
});

setInterval(fetchData, 60000);
