// ======================================================================================
// === ВАЖНО: Обновите эти две переменные, используя ПОЛНЫЕ ССЫЛКИ НА ОПУБЛИКОВАННЫЙ CSV ===
// ======================================================================================

// URL-адрес CSV для листа "Target" (должен быть получен через Файл -> Опубликовать в интернете)
const TARGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=1172056164&single=true&output=csv';

// URL-адрес CSV для листа "Лист16" (должен быть получен через Файл -> Опубликовать в интернете)
const SALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=407492630&single=true&output=csv';

// --- ФУНКЦИЯ cleanGroup УДАЛЕНА СОГЛАСНО ВАШЕМУ ЗАПРОСУ ---

// Парсинг и агрегация для ЛИСТА16 (Продажи)
// Столбцы: ШипДате(0), Group(1), Class(2), Номенклатура.Парент(3), USD(4)
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
 * Надежный парсинг чисел, корректно обрабатывающий европейский формат.
 */
function cleanAndParseNumber(rawString) {
    if (!rawString) return NaN;

    let cleaned = rawString
        .replace(/[^0-9,\.\-\s]/g, '')
        .replace(/\s/g, '')
        .replace(/\u00A0/g, '')
        .trim();

    if (cleaned === '') return NaN;
    
    if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? NaN : num;
}

/**
 * Исправляет ошибки точности чисел с плавающей запятой в JavaScript (финансовая точность).
 */
function roundToPrecision(num, precision = 10) {
    if (Math.abs(num) < 1e-10) return 0;
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
}

// ======================================================================================
// === ФОРМАТИРОВАНИЕ: УДАЛЕНЫ formatNumber и formatPercent. ===
// ======================================================================================

// УДАЛЕНО: function formatNumber(num) { ... }
// УДАЛЕНО: function formatPercent(num) { ... }

/**
 * Вспомогательная функция для форматирования процентов без Intl.NumberFormat.
 * Просто умножает на 100 и добавляет знак %.
 */
function formatRawPercent(num) {
    // num - это число, например, 1.042
    return (num * 100).toFixed(6) + '%'; // Используем toFixed(6) для видимой точности
}

// Определение класса CSS для цвета %
function getPercentClass(value) {
    if (value >= 1) return 'percent-good';
    if (value >= 0.85) return 'percent-ok';
    return 'percent-bad';
}

// ======================================================================================
// === ПАРСИНГ CSV (Логика суммирования с коррекцией точности) ===
// ======================================================================================

// Парсинг и агрегация для ЛИСТА16 (Продажи)
function parseSalesCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedSales = {};
    const separator = (lines.length > 1 && lines[1].split(';').length > 1) ? ';' : ',';

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(separator);
        if (row.length < 5) continue;

        const rawGroup = row[1] ? row[1].trim() : '';
        const group = cleanGroup(rawGroup);
        const usdValueString = row[4] ? row[4].trim() : '';
        
        if (usdValueString.trim() === '') continue;
        
        const usdValue = cleanAndParseNumber(usdValueString); 
        const key = group === '' ? 'UNGROUPED_SALES' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            let currentSum = aggregatedSales[key] || 0;
            aggregatedSales[key] = roundToPrecision(currentSum + usdValue); 
        } else if (usdValueString.trim() !== '') {
             console.warn(`[ПАРСИНГ SALES] Пропущена нечисловая строка: Group=${rawGroup || 'N/A'}, Raw USD="${row[4]}".`);
             continue;
        }
    }
    console.log('--- АГРЕГИРОВАННЫЕ ПРОДАЖИ (ДО ФОРМАТИРОВАНИЯ) ---');
    console.log(aggregatedSales);
    return aggregatedSales;
}


// Парсинг и агрегация для ЛИСТА Target
function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedTarget = {};
    const separator = (lines.length > 1 && lines[1].split(';').length > 1) ? ';' : ',';

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(separator);
        if (row.length < 4) continue;

        const rawGroup = row[2] ? row[2].trim() : '';
        const group = cleanGroup(rawGroup);
        const usdValueString = row[3] ? row[3].trim() : '';

        if (usdValueString.trim() === '') continue;

        const usdValue = cleanAndParseNumber(usdValueString); 
        const key = group === '' ? 'UNGROUPED_TARGET' : group;

        if (!isNaN(usdValue) && usdValue !== 0) {
            let currentSum = aggregatedTarget[key] || 0;
            aggregatedTarget[key] = roundToPrecision(currentSum + usdValue);
        } else if (usdValueString.trim() !== '') {
            console.warn(`[ПАРСИНГ TARGET] Пропущена нечисловая строка: Group=${rawGroup || 'N/A'}, Raw USD="${row[3]}".`);
            continue;
        }
    }
    console.log('--- АГРЕГИРОВАННЫЕ ЦЕЛИ (ДО ФОРМАТИРОВАНИЯ) ---');
    console.log(aggregatedTarget);
    return aggregatedTarget;
}

// ======================================================================================
// === ОСНОВНАЯ ЛОГИКА (Отображение сырых чисел) ===
// ======================================================================================

document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    // Используем toLocaleString только для даты
    document.getElementById('last-update').textContent = now.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    fetchData();
});

async function fetchData() {
    if (TARGET_CSV_URL.includes('СЮДА_ВСТАВЬТЕ')) {
        console.error('Ошибка: Не обновлены URL-адреса Google Sheets в script.js.');
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
        
        // ВЫВОД ДЛЯ ОТЛАДКИ РАСХОЖДЕНИЙ
        const salesLines = salesCSV.split('\n').filter(line => line.trim() !== '');
        console.log('--- ПРОВЕРКА ИСХОДНЫХ ДАННЫХ SALES ---');
        console.log(`Количество строк в Sales CSV: ${salesLines.length - 1} (без заголовка)`);
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


// Построение таблицы и KPI
function processData(combinedData) {
    let totalTarget = 0;
    let totalSales = 0;

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
        alert('Данные не загружены. Проверьте форматирование в Google Sheets.');
        return;
    }

    console.log(`Успех! Обнаружено ${sortedGroups.length} групп для отображения.`);

    for (const group of sortedGroups) {
        const item = combinedData[group];
        const target = Number(item.target) || 0;
        const sales = Number(item.sales) || 0;

        const execution = (target === 0) ? 0 : roundToPrecision(sales / target); 
        const difference = roundToPrecision(target - sales);

        totalTarget = roundToPrecision(totalTarget + target);
        totalSales = roundToPrecision(totalSales + sales);
        
        // --- ПРЕДОСТВРАЩАЕМ ПРОБЛЕМУ ТОЧНОСТИ ОТОБРАЖЕНИЯ ---
        // Используем toFixed(6) для отображения в HTML, чтобы увидеть дробную часть.
        const targetDisplay = target.toFixed(6);
        const salesDisplay = sales.toFixed(6);
        const diffDisplay = difference.toFixed(6);
        const executionDisplay = formatRawPercent(execution);
        // ----------------------------------------------------

        const row = document.createElement('tr');
        const percentClass = getPercentClass(execution);

        row.innerHTML = `
            <td>${group}</td>
            <td class="align-right">${targetDisplay}</td>
            <td class="align-right">${salesDisplay}</td>
            <td class="align-right ${percentClass}">${executionDisplay}</td>
            <td class="align-right">${diffDisplay}</td>
        `;
        tableBody.appendChild(row);

        chartLabels.push(group);
        chartTargets.push(target);
        chartSales.push(sales);
    }

    const totalExecution = (totalTarget === 0) ? 0 : roundToPrecision(totalSales / totalTarget);
    const totalDifference = roundToPrecision(totalTarget - totalSales);

    // --- ВЫВОД ИТОГОВ С МАКСИМАЛЬНОЙ ТОЧНОСТЬЮ ---
    const totalTargetDisplay = totalTarget.toFixed(6);
    const totalSalesDisplay = totalSales.toFixed(6);
    const totalDiffDisplay = totalDifference.toFixed(6);
    const totalExecutionDisplay = formatRawPercent(totalExecution);
    // ---------------------------------------------


    // ВЫВОД В КОНСОЛЬ ОБЩИХ ИТОГОВ
    console.log('--- ОБЩИЕ ИТОГИ (ДО ФОРМАТИРОВАНИЯ) ---');
    console.log(`Total Target (Number): ${totalTarget}`);
    console.log(`Total Sales (Number): ${totalSales}`);
    console.log(`Total Execution (Number): ${totalExecution}`);
    console.log('-------------------------------------------');

    // Обновление HTML с использованием сырых, высокоточных чисел
    document.getElementById('total-target').textContent = totalTargetDisplay;
    document.getElementById('total-sales').textContent = totalSalesDisplay;
    document.getElementById('total-percent').textContent = totalExecutionDisplay;
    document.getElementById('total-percent').className = `kpi-percent ${getPercentClass(totalExecution)}`;

    document.getElementById('footer-target').textContent = totalTargetDisplay;
    document.getElementById('footer-sales').textContent = totalSalesDisplay;
    document.getElementById('footer-percent').textContent = totalExecutionDisplay;
    document.getElementById('footer-percent').className = getPercentClass(totalExecution);
    document.getElementById('footer-diff').textContent = totalDiffDisplay;

    renderChart(chartLabels, chartTargets, chartSales);
}

// Функция для рендеринга графика (Chart.js)
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
                            // Используем сырую строку с точкой и точностью
                            return `${context.dataset.label}: ${context.raw.toFixed(6)}`; 
                        } 
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            // Используем сырую строку с точкой и точностью
                            return value.toFixed(6); 
                        }
                    }
                }
            }
        }
    });
}

setInterval(fetchData, 60000);
