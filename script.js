// ======================================================================================
// === ВАЖНО: Обновите эти две переменные, используя ПОЛНЫЕ ССЫЛКИ НА ОПУБЛИКОВАННЫЙ CSV ===
// ======================================================================================

// URL-адрес CSV для листа "Target" (должен быть получен через Файл -> Опубликовать в интернете)
const TARGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=1172056164&single=true&output=csv';

// URL-адрес CSV для листа "Лист16" (должен быть получен через Файл -> Опубликовать в интернете)
const SALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=407492630&single=true&output=csv';

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
 * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Преобразует европейский разделитель '123,45' в 123.45 
 * и обеспечивает максимальную очистку.
 */
function cleanAndParseNumber(rawString) {
    if (!rawString) return NaN;

    // 1. Очистка и удаление лишних символов
    let cleaned = rawString
        .trim()
        .replace(/^"|"$/g, '')        // Удаляем внешние кавычки (из-за CSV)
        .replace(/\s/g, '')            // Удаляем все пробелы
        .replace(/\u00A0/g, '')       // Удаляем неразрывные пробелы
        .replace(/[^\d,\.\-]/g, '');  // Удаляем все, КРОМЕ цифр, запятой, точки и минуса

    if (cleaned === '') return NaN;
    
    // 2. Стандартизация: преобразуем европейский формат "X,YY" в "X.YY"
    if (cleaned.includes(',')) {
        // Если есть и запятая, и точка (разделители тысяч), убираем точки
        if (cleaned.includes('.')) {
            cleaned = cleaned.replace(/\./g, '');
        }
        // Заменяем запятую на точку
        cleaned = cleaned.replace(',', '.'); 
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? NaN : num;
}

/**
 * ОБЯЗАТЕЛЬНО: Исправляет ошибки точности чисел с плавающей запятой в JavaScript 
 * и округляет до двух знаков после запятой для финального суммирования.
 */
function roundToPrecision(num, precision = 12) {
    // Шаг 1: Исправляем ошибки точности
    if (Math.abs(num) < 1e-10) return 0;
    const factor = Math.pow(10, precision);
    const correctedNum = Math.round(num * factor) / factor;
    
    // Шаг 2: Округляем до двух знаков после запятой для финальной суммы (внутреннее хранение)
    const finalFactor = 100;
    return Math.round(correctedNum * finalFactor) / finalFactor; 
}


// ======================================================================================
// === ФОРМАТИРОВАНИЕ (ТОЛЬКО ЦЕЛЫЕ ЧИСЛА) ===
// ======================================================================================

/**
 * Форматирование чисел: Используется ВЕЗДЕ.
 * Выводит ЦЕЛЫЕ числа (0 знаков после запятой), так как мы уже округлили их
 * в функции parseCSV.
 */
// Используется для KPI (Target/Sales Projection) - ЦЕЛЫЕ ЧИСЛА
// Используется для вывода ЦЕЛЫХ чисел (везде, включая группы и итог)
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0,
    }).format(num);
}
// Убедитесь, что formatNumberWithDecimals удалена или не используется!
// Используется для Таблицы - С ДВУМЯ ЗНАКАМИ
function formatNumberWithDecimals(num) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2,
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
// === ПАРСИНГ CSV (УСИЛЕННЫЙ И С ОКРУГЛЕНИЕМ СТРОК) ===
// ======================================================================================

// Пожалуйста, замените эту функцию в вашем файле script.js
function parseSalesCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedSales = {};

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        
        if (row.length < 5) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));

        const rawGroup = cleanRow[1] || '';
        const group = cleanGroup(rawGroup);
        const usdValueString = cleanRow[4] || ''; 
        
        if (usdValueString.trim() === '') continue;
        
        let usdValue = cleanAndParseNumber(usdValueString); 
        const key = group === '' ? 'UNGROUPED_SALES' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            // !!! ИСПРАВЛЕНИЕ: Удаляем Math.round() - суммируем дробные числа !!!
            // usdValue = Math.round(usdValue); 
            
            let currentSum = aggregatedSales[key] || 0;
            aggregatedSales[key] = roundToPrecision(Number(currentSum) + Number(usdValue)); 
        } else if (usdValueString.trim() !== '') {
             console.warn(`[ПАРСИНГ SALES] Пропущена нечисловая строка: Raw USD="${cleanRow[4]}".`);
             continue;
        }
    }
    return aggregatedSales;
}

// Пожалуйста, замените эту функцию в вашем файле script.js
function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedTarget = {};

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
            // !!! ИСПРАВЛЕНИЕ: Удаляем Math.round() - суммируем дробные числа !!!
            // usdValue = Math.round(usdValue);
            
            let currentSum = aggregatedTarget[key] || 0;
            aggregatedTarget[key] = roundToPrecision(Number(currentSum) + Number(usdValue));
        } else if (usdValueString.trim() !== '') {
            console.warn(`[ПАРСИНГ TARGET] Пропущена нечисловая строка: Raw USD="${cleanRow[3]}".`);
            continue;
        }
    }
    return aggregatedTarget;
}


// ======================================================================================
// === ОСНОВНАЯ ЛОГИКА И ВЫВОД (Используем formatNumber ВЕЗДЕ) ===
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
        
        console.log('--- ПРОВЕРКА ИСХОДНЫХ ДАННЫХ SALES ---');
        console.log(`Количество строк в Sales CSV: ${salesCSV.split('\n').length - 1} (без заголовка)`);
        console.log(`Первые 500 символов Sales CSV: \n${salesCSV.substring(0, 500)}...`);
        console.log('-------------------------------------------');
        

        const targets = parseTargetCSV(targetCSV);
        const sales = parseSalesCSV(salesCSV);

        const combinedData = combineData(targets, sales);

        processData(combinedData);

    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА FETCH/ПАРСИНГА:', error);
        alert(`Критическая ошибка! См. консоль разработчика (F12) для деталей.`);
    }
}

function combineData(targets, sales) {
    const combined = {};
    const allGroups = new Set([...Object.keys(targets), ...Object.keys(sales)]);

    allGroups.forEach(group => {
        if (group && group.trim() !== '') {
            combined[group] = {
                target: targets[group] || 0,
                sales: sales[group] || 0
            };
        }
    });
    return combined;
}


function processData(combinedData) {
    // 1. ПЕРЕМЕННЫЕ ДЛЯ ТОЧНОГО РАСЧЕТА % (Суммируем дробные числа)
    let totalTarget = 0; 
    let totalSales = 0;   
    
    // 2. ПЕРЕМЕННЫЕ ДЛЯ ВЫВОДА В ТОТАЛ (Суммируем округленные суммы групп)
    let displayTotalTarget = 0;
    let displayTotalSales = 0;
    
    const tableBody = document.getElementById('data-table-body');
    tableBody.innerHTML = '';

    const chartLabels = [];
    const chartTargets = [];
    const chartSales = [];

    const sortedGroups = Object.keys(combinedData).sort((a, b) => {
        return combinedData[b].target - combinedData[a].target;
    });

    if (sortedGroups.length === 0) {
        console.error('ОШИБКА ОБРАБОТКИ: combinedData пуст. Парсинг не дал результатов.');
        return;
    }

    for (const group of sortedGroups) {
        const item = combinedData[group];
        // Дробные значения группы, пришедшие из парсера
        const target = Number(item.target) || 0; 
        const sales = Number(item.sales) || 0;     
        
        // A. Обновление точных сумм для расчета процента
        totalTarget = roundToPrecision(totalTarget + target);
        totalSales = roundToPrecision(totalSales + sales);

        // B. Округление суммы группы до целого числа (например, 4318194.53 -> 4318195)
        const roundedTarget = Math.round(target); 
        const roundedSales = Math.round(sales);     
        
        // C. Обновление сумм для вывода ТОТАЛА
        displayTotalTarget += roundedTarget; // <--- КЛЮЧЕВАЯ ЛИНИЯ: СУММА ОКРУГЛЕННЫХ
        displayTotalSales += roundedSales;   // <--- КЛЮЧЕВАЯ ЛИНИЯ: СУММА ОКРУГЛЕННЫХ

        const execution = (target === 0) ? 0 : roundToPrecision(sales / target); 
        const difference = roundToPrecision(target - sales);

        const row = document.createElement('tr');
        const percentClass = getPercentClass(execution);

        // В таблице используем округленные суммы групп
        row.innerHTML = `
            <td>${group}</td>
            <td class="align-right">${formatNumber(roundedTarget)}</td> 
            <td class="align-right">${formatNumber(roundedSales)}</td>  
            <td class="align-right ${percentClass}">${formatPercent(execution)}</td>
            <td class="align-right">${formatNumber(difference)}</td>
        `;
        tableBody.appendChild(row);

        chartLabels.push(group);
        chartTargets.push(target);
        chartSales.push(sales);
    }
    
    // РАСЧЕТ ИТОГОВ ДЛЯ ВЫВОДА
    const totalExecution = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    const displayTotalDifference = displayTotalTarget - displayTotalSales; 
    
    // Обновление HTML (KPI)
    document.getElementById('total-target').textContent = formatNumber(displayTotalTarget); // <-- ИСПОЛЬЗУЕМ СУММУ ОКРУГЛЕННЫХ
    document.getElementById('total-sales').textContent = formatNumber(displayTotalSales);   // <-- ИСПОЛЬЗУЕМ СУММУ ОКРУГЛЕННЫХ
    document.getElementById('total-percent').textContent = formatPercent(totalExecution);
    document.getElementById('total-percent').className = `kpi-percent ${getPercentClass(totalExecution)}`;

    // Обновление футера
    document.getElementById('footer-target').textContent = formatNumber(displayTotalTarget); // <-- ИСПОЛЬЗУЕМ СУММУ ОКРУГЛЕННЫХ
    document.getElementById('footer-sales').textContent = formatNumber(displayTotalSales);   // <-- ИСПОЛЬЗУЕМ СУММУ ОКРУГЛЕННЫХ
    document.getElementById('footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('footer-percent').className = getPercentClass(totalExecution);
    document.getElementById('footer-diff').textContent = formatNumber(displayTotalDifference);

    renderChart(chartLabels, chartTargets, chartSales);
}
    
    // !!! ТЕСТИРОВАНИЕ !!!
    console.log(`[ФИНАЛЬНЫЙ ИТОГ TARGET - ДЛЯ ДИСПЛЕЯ]: ${displayTotalTarget}`);

    const totalExecution = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    
    // Обновление HTML (KPI)
    // ИСПОЛЬЗУЕМ displayTotalTarget и displayTotalSales для вывода
    document.getElementById('total-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('total-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('total-percent').textContent = formatPercent(totalExecution);
    document.getElementById('total-percent').className = `kpi-percent ${getPercentClass(totalExecution)}`;

    // Общий difference рассчитываем на основе displayTotal, чтобы он тоже был целым.
    const displayTotalDifference = displayTotalTarget - displayTotalSales; 
    
    // ИСПОЛЬЗУЕМ displayTotalTarget и displayTotalSales для футера
    document.getElementById('footer-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('footer-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('footer-percent').className = getPercentClass(totalExecution);
    document.getElementById('footer-diff').textContent = formatNumber(displayTotalDifference);

    renderChart(chartLabels, chartTargets, chartSales);
}

function renderChart(labels, targetData, salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');

    if (window.myChart instanceof Chart) {
        window.myChart.destroy();
    }
    
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Target',
                    data: targetData,
                    backgroundColor: '#d9534f',
                    borderColor: '#d9534f',
                    borderWidth: 1
                },
                {
                    label: 'Sales',
                    data: salesData,
                    backgroundColor: '#5bc0de',
                    borderColor: '#5bc0de',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: { display: true, text: 'Target vs Sales по Группам' },
                tooltip: {
                    callbacks: { 
                        label: function(context) { 
                            // Всплывающие подсказки тоже используем целые числа
                            return `${context.dataset.label}: ${formatNumber(context.raw)}`; 
                        } 
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            // Ось Y используем целые числа
                            return formatNumber(value); 
                        }
                    }
                }
            }
        }
    });
}

setInterval(fetchData, 60000);
