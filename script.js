// ======================================================================================
// === ВАЖНО: Обновите эти две переменные, используя ПОЛНЫЕ ССЫЛКИ НА ОПУБЛИКОВАННЫЙ CSV ===
// ======================================================================================

// URL-адрес CSV для листа "Target" (должен быть получен через Файл -> Опубликовать в интернете)
const TARGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=1172056164&single=true&output=csv';

// URL-адрес CSV для листа "Лист16" (должен быть получен через Файл -> Опубликовать в интернете)
const SALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mDZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=407492630&single=true&output=csv';

// --- ФУНКЦИЯ cleanGroup УДАЛЕНА СОГЛАСНО ВАШЕМУ ЗАПРОСУ ---

// Парсинг и агрегация для ЛИСТА16 (Продажи)
// Столбцы: ШипДате(0), Group(1), Class(2), Номенклатура.Парент(3), USD(4)
function parseSalesCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedSales = {};

    // Надежное определение разделителя: проверяем, что чаще встречается в первой строке данных
    const separator = (lines.length > 1 && lines[1].split(';').length > 1) ? ';' : ','; 

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(separator);

        if (row.length < 5) continue;

        // Используем исходное значение, переведенное в верхний регистр
        const group = row[1] ? row[1].trim().toUpperCase() : ''; 

        let usdValue = row[4] ? row[4].trim() : '0';

        // Очистка и преобразование USD в число
        usdValue = parseFloat(usdValue.replace(/['"₽$,]/g, '').replace(/\s/g, ''));

        if (group && !isNaN(usdValue) && group !== '') {
            aggregatedSales[group] = (aggregatedSales[group] || 0) + usdValue;
        }
    }
    return aggregatedSales; 
}


// Парсинг и агрегация для ЛИСТА Target
// Столбцы: Парент(0), Class(1), Group(2), USD(3)
function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedTarget = {};

    // Надежное определение разделителя
    const separator = (lines.length > 1 && lines[1].split(';').length > 1) ? ';' : ','; 

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(separator);

        if (row.length < 4) continue;

        // Используем исходное значение, переведенное в верхний регистр
        const group = row[2] ? row[2].trim().toUpperCase() : '';

        let usdValue = row[3] ? row[3].trim() : '0';

        // Очистка и преобразование USD (обрабатываем русские числа: 2 998,55 -> 2998.55)
        usdValue = usdValue.replace(/\./g, '').replace(/,/g, '.'); 
        usdValue = parseFloat(usdValue.replace(/['"₽$]/g, '').replace(/\s/g, ''));

        if (group && !isNaN(usdValue) && group !== '') {
            aggregatedTarget[group] = (aggregatedTarget[group] || 0) + usdValue;
        }
    }
    return aggregatedTarget; 
}

// Форматирование чисел (9 360 956)
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(num));
}

// Форматирование процентов (88,1%)
function formatPercent(num) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }).format(num);
}

// Определение класса CSS для цвета %
function getPercentClass(value) {
    if (value >= 1) return 'percent-good';
    if (value >= 0.85) return 'percent-ok';
    return 'percent-bad';
}

// ======================================================================================
// === Основная логика загрузки и рендеринга ===
// ======================================================================================

document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
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

        // --- ПРОВЕРКА СТАТУСА СЕТИ ---
        if (!targetResponse.ok || !salesResponse.ok) {
            const status = !targetResponse.ok ? targetResponse.status : salesResponse.status;
            console.error(`КРИТИЧЕСКАЯ ОШИБКА СЕТИ. Статус: ${status}.`);
            console.error('ПРИЧИНА: Google заблокировал доступ (CORS).');
            alert(`Ошибка! Статус ${status}. Пожалуйста, ПОВТОРНО ОПУБЛИКУЙТЕ CSV-файлы в Google Sheets.`);
            return;
        }

        const targetCSV = await targetResponse.text();
        const salesCSV = await salesResponse.text();

        // --- ПРОВЕРКА ПУСТЫХ ДАННЫХ ---
        if (targetCSV.length < 50 || salesCSV.length < 50) {
            console.warn('Предупреждение: Один из CSV-файлов пуст или слишком мал.');
        }

        const targets = parseTargetCSV(targetCSV);
        const sales = parseSalesCSV(salesCSV);

        const combinedData = combineData(targets, sales);

        processData(combinedData);

    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА FETCH/ПАРСИНГА:', error);
        alert(`Критическая ошибка! См. консоль разработчика (F12) для деталей.`);
    }
}

// Объединение данных из двух объектов в один
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

    // --- ПРОВЕРКА ОТСУТСТВИЯ ДАННЫХ ПОСЛЕ ПАРСИНГА ---
    if (sortedGroups.length === 0) {
        console.error('ОШИБКА ОБРАБОТКИ: combinedData пуст. Парсинг не дал результатов.');
        alert('Данные не загружены. Проверьте форматирование в Google Sheets (разделители, лишние строки).');
        return;
    }

    console.log(`Успех! Обнаружено ${sortedGroups.length} групп для отображения.`);

    for (const group of sortedGroups) {
        const item = combinedData[group];
        const target = Number(item.target) || 0;
        const sales = Number(item.sales) || 0;

        const execution = (target === 0) ? 0 : sales / target;
        const difference = target - sales;

        totalTarget += target;
        totalSales += sales;

        const row = document.createElement('tr');
        const percentClass = getPercentClass(execution);

        row.innerHTML = `
            <td>${group}</td>
            <td class="align-right">${formatNumber(target)}</td>
            <td class="align-right">${formatNumber(sales)}</td>
            <td class="align-right ${percentClass}">${formatPercent(execution)}</td>
            <td class="align-right">${formatNumber(difference)}</td>
        `;
        tableBody.appendChild(row);

        chartLabels.push(group);
        chartTargets.push(target);
        chartSales.push(sales);
    }

    // Обновление KPI и Итогов
    const totalExecution = (totalTarget === 0) ? 0 : totalSales / totalTarget;
    const totalDifference = totalTarget - totalSales;

    document.getElementById('total-target').textContent = formatNumber(totalTarget);
    document.getElementById('total-sales').textContent = formatNumber(totalSales);
    document.getElementById('total-percent').textContent = formatPercent(totalExecution);
    document.getElementById('total-percent').className = `kpi-percent ${getPercentClass(totalExecution)}`;

    document.getElementById('footer-target').textContent = formatNumber(totalTarget);
    document.getElementById('footer-sales').textContent = formatNumber(totalSales);
    document.getElementById('footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('footer-percent').className = getPercentClass(totalExecution);
    document.getElementById('footer-diff').textContent = formatNumber(totalDifference);

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
                    callbacks: { label: function(context) { return `${context.dataset.label}: ${formatNumber(context.raw)}`; } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000) return (value / 1000000) + ' млн';
                            if (value >= 1000) return (value / 1000) + ' тыс.';
                            return value;
                        }
                    }
                }
            }
        }
    });
}

setInterval(fetchData, 60000);
