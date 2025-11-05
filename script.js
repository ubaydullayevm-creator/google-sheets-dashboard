// ======================================================================================
// === ВАЖНО: Обновите эти две переменные, используя ПОЛНЫЕ ССЫЛКИ НА ОПУБЛИКОВАННЫЙ CSV ===
// ======================================================================================

// URL-адрес CSV для листа "Target" (должен быть получен через Файл -> Опубликовать в интернете)
const TARGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=1172056164&single=true&output=csv';

// URL-адрес CSV для листа "Лист16" (должен быть получен через Файл -> Опубликовать в интернете)
const SALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=407492630&single=true&output=csv';

let allCombinedData = {}; // Здесь будут храниться все данные после загрузки
let currentChart;         // Ссылка на объект Chart.js для его уничтожения перед обновлением
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
// === ФОРМАТИРОВАНИЕ (ТОЛЬКО ЦЕЛЫЕ ЧИСЛА) ===
// ======================================================================================

/**
 * Форматирование чисел: Используется ВЕЗДЕ.
 * Выводит ЦЕЛЫЕ числа (0 знаков после запятой).
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
// === ПАРСИНГ CSV ===
// ======================================================================================

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
            let currentSum = aggregatedSales[key] || 0;
            aggregatedSales[key] = roundToPrecision(Number(currentSum) + Number(usdValue)); 
        } else if (usdValueString.trim() !== '') {
             console.warn(`[ПАРСИНГ SALES] Пропущена нечисловая строка: Raw USD="${cleanRow[4]}".`);
        }
    }
    return aggregatedSales;
}

function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedTarget = {};

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        
        if (row.length < 4) continue;

        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, ''));

        const rawGroup = cleanRow[2] || ''; // Индекс 2 для Target Group
        const group = cleanGroup(rawGroup);
        const usdValueString = cleanRow[3] || ''; // Индекс 3 для Target USD

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
// === ОСНОВНАЯ ЛОГИКА И ВЫВОД (С ФИЛЬТРАЦИЕЙ) ===
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
        const sales = parseSalesCSV(salesCSV);

        allCombinedData = combineData(targets, sales); // Сохраняем все данные
        generateFilterButtons(allCombinedData); // Генерируем кнопки после загрузки
        processData(allCombinedData); // Изначально отображаем все данные

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

function generateFilterButtons(data) {
    const filterContainer = document.getElementById('group-filters');
    filterContainer.innerHTML = ''; // Очищаем существующие кнопки

    const groups = new Set();
    Object.keys(data).forEach(group => {
        const groupKey = group.toUpperCase();
        // Исключаем TIER и UNGROUPED из списка кнопок
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
            const filteredData = { [group]: allCombinedData[group] }; // Фильтруем данные для одной группы
            processData(filteredData);
        });
        filterContainer.appendChild(button);
    });
}

function updateFilterButtons() {
    document.querySelectorAll('.filter-button').forEach(button => {
        button.classList.remove('active');
        if (button.textContent === selectedFilterGroup || (selectedFilterGroup === 'All' && button.textContent === 'All')) {
            button.classList.add('active');
        }
    });
}


function processData(dataToProcess) {
    let totalTarget = 0; 
    let totalSales = 0;   
    
    let displayTotalTarget = 0;
    let displayTotalSales = 0;
    
    const tableBody = document.getElementById('data-table-body');
    tableBody.innerHTML = '';

    const chartLabels = [];
    const chartTargets = [];
    const chartSales = [];

    const sortedGroups = Object.keys(dataToProcess).sort((a, b) => {
        return dataToProcess[b].target - dataToProcess[a].target;
    });

    if (sortedGroups.length === 0) {
        console.log('Нет данных для отображения после фильтрации или данные пусты.');
        // Очищаем KPI, если нет данных для выбранной группы
        document.getElementById('total-target').textContent = formatNumber(0);
        document.getElementById('total-sales').textContent = formatNumber(0);
        document.getElementById('total-percent').textContent = formatPercent(0);
        document.getElementById('total-percent').className = `kpi-percent ${getPercentClass(0)}`;
        document.getElementById('footer-target').textContent = formatNumber(0);
        document.getElementById('footer-sales').textContent = formatNumber(0);
        document.getElementById('footer-percent').textContent = formatPercent(0);
        document.getElementById('footer-percent').className = getPercentClass(0);
        document.getElementById('footer-diff').textContent = formatNumber(0);
        renderChart([], [], []); // Очищаем график
        return;
    }

    for (const group of sortedGroups) {
        const item = dataToProcess[group];
        const target = Number(item.target) || 0; 
        const sales = Number(item.sales) || 0;     
        
        const groupKey = group.toUpperCase();
        
        // !!! ФИЛЬТРАЦИЯ ГРУППЫ: ЕСЛИ TIER ИЛИ UNGROUPED - ПРОПУСКАЕМ СТРОКУ ПОЛНОСТЬЮ !!!
        const isExcludedGroup = groupKey === 'TIER' || 
                                groupKey.startsWith('UNGROUPED');
        
        if (isExcludedGroup) {
             continue; // Полностью пропускаем эту строку в цикле
        }
        // !!! КОНЕЦ ФИЛЬТРАЦИИ !!!
        
        // A. Обновление точных сумм для расчета процента (только для НЕИСКЛЮЧЕННЫХ групп)
        totalTarget = roundToPrecision(totalTarget + target);
        totalSales = roundToPrecision(totalSales + sales);

        // B. Округление суммы группы до целого числа (для отображения)
        const roundedTarget = Math.round(target); 
        const roundedSales = Math.round(sales);     
        
        // C. Обновление сумм для вывода ТОТАЛА (только для НЕИСКЛЮЧЕННЫХ групп)
        displayTotalTarget += roundedTarget; 
        displayTotalSales += roundedSales;   

        // D. Отображение в таблице
        const execution = (target === 0) ? 0 : roundToPrecision(sales / target); 
        const difference = roundToPrecision(target - sales);

        const row = document.createElement('tr');
        const percentClass = getPercentClass(execution);

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
    document.getElementById('total-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('total-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('total-percent').textContent = formatPercent(totalExecution);
    document.getElementById('total-percent').className = `kpi-percent ${getPercentClass(totalExecution)}`;

    // Обновление футера
    document.getElementById('footer-target').textContent = formatNumber(displayTotalTarget);
    document.getElementById('footer-sales').textContent = formatNumber(displayTotalSales);
    document.getElementById('footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('footer-percent').className = getPercentClass(totalExecution);
    document.getElementById('footer-diff').textContent = formatNumber(displayTotalDifference);

    renderChart(chartLabels, chartTargets, chartSales);
}

function renderChart(labels, targetData, salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');

    if (currentChart) { // Используем глобальную переменную currentChart
        currentChart.destroy();
    }
    
    currentChart = new Chart(ctx, { // Присваиваем объект Chart.js глобальной переменной
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
                            return formatNumber(value); 
                        }
                    }
                }
            }
        }
    });
}

setInterval(fetchData, 60000); // Обновляем данные каждую минуту
