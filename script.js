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
// === ФУНКЦИИ ТОЧНОСТИ И ПАРСИНГА ЧИСЕЛ И СТРОГОВ ФОРМАТА ===
// ======================================================================================

/** Очистка имени группы (используется ТОЛЬКО для верхней таблицы) */
function cleanGroup(rawGroup) {
    if (typeof rawGroup !== 'string') return '';
    const match = rawGroup.trim().toUpperCase().match(/[A-Z]{2,3}/); 
    if (match) {
        return match[0].substring(0, 3);
    }
    return '';
}

/** 🚨 КЛЮЧЕВАЯ ФУНКЦИЯ: Исключаем только ДАТЫ и ГЕО-НАЗВАНИЯ (Версия 11) */
function isDateOrGeneral(key) {
    if (typeof key !== 'string' || key.trim() === '') return true; // Исключаем пустые/нестроковые
    const trimmedUpper = key.trim().toUpperCase();
    
    // 1. Даты (xx.xx.xxxx) - главный источник мусора
    if (trimmedUpper.match(/^\d{2}\.\d{2}\.\d{4}$/)) return true; 
    
    // 2. Общие / Географические названия, которые могут ошибочно попасть как Паренты
    // Судя по скриншотам, эти названия имеют Target, значит, их нужно исключать
    const generalExclusions = ['TRADE', 'BUKHARA', 'NAMANGAN', 'TERMEZ', 'URGENCH', 'TA', 'PURINA', 'TOTAL'];
    if (generalExclusions.includes(trimmedUpper)) return true;

    // 3. Дополнительная проверка на чистую группу (2-3 заглавные буквы)
    // Эта проверка нужна, только если чистые группы попали в Target CSV
    if (trimmedUpper.match(/^[A-Z]{2,3}$/)) {
        const pureGroups = ['IN', 'PF', 'CNF', 'NCF', 'DAI', 'CLN', 'CPW'];
        if (pureGroups.includes(trimmedUpper)) return true;
    }
    
    return false;
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


// ======================================================================================
// === ПАРСИНГ CSV (ПРИМЕНЕНИЕ СТРОГОГО ИСКЛЮЧЕНИЯ) ===
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

            // 1. Агрегация по Группе (для верхней таблицы) - ВСЕГДА АГРЕГИРУЕМ
            let currentSumGroup = targetsByGroup[keyGroup] || 0;
            targetsByGroup[keyGroup] = roundToPrecision(Number(currentSumGroup) + Number(usdValue));

            // 2. Агрегация по Продукту (для нижней таблицы) - ТОЛЬКО ЕСЛИ НЕ ДАТА/ГЕО/ГРУППА
            if (!isDateOrGeneral(keyProduct)) {
                targetsByProduct[keyProduct] = {
                    target: roundToPrecision((targetsByProduct[keyProduct]?.target || 0) + usdValue),
                    group: keyGroup
                };
            }
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
        
        const rawGroupAndProduct = cleanRow[1] || ''; 
        const usdValueString = cleanRow[4] || ''; 

        if (usdValueString.trim() === '') continue;

        let usdValue = cleanAndParseNumber(usdValueString);
        
        // 1. Агрегация по ГРУППЕ (для верхней таблицы) - ВСЕГДА АГРЕГИРУЕМ
        const group = cleanGroup(rawGroupAndProduct); 
        const key = group === '' ? 'UNGROUPED_SALES' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            usdValue = roundToPrecision(usdValue);

            // Агрегация для верхней таблицы (по ЧИСТОЙ Группе)
            let currentSumGroup = aggregatedSales[key] || 0;
            aggregatedSales[key] = roundToPrecision(Number(currentSumGroup) + Number(usdValue));

            // 2. Детализация для нижней таблицы (по Продукту/Паренту). 
            const productDetail = rawGroupAndProduct.trim() || 'Не определено'; 
            
            // 🚨 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Добавляем в детализацию ТОЛЬКО ЕСЛИ НЕ ДАТА/ГЕО/ГРУППА
            if (!isDateOrGeneral(productDetail)) {
                detailedSales.push({
                    Group: group, 
                    Sales: usdValue,
                    Product: productDetail // Название товара/парент
                });
            }
        }
    }
    return { aggregatedSales, detailedSales };
}


// ======================================================================================
// === ОБЪЕДИНЕНИЕ И ФИЛЬТРАЦИЯ (СВЯЗКА) (Без изменений) ===
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

/** Агрегация данных по Продуктам (называемым 'Территория' в таблице) (Без изменений) */
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
    
    // Используем ТОЛЬКО ключи Парентов, которые прошли фильтрацию в parseTargetCSV
    const allProducts = Object.keys(productTargets); 

    allProducts.forEach(product => {
        const targetData = productTargets[product] || { target: 0, group: '' };
        const salesData = aggregatedSales[product] || { sales: 0 };
        
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
    fetchData();
});

setInterval(fetchData, 60000);
