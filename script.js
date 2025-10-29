// ======================================================================================
// === ВАЖНО: Обновите эти две переменные, используя ПОЛНЫЕ ССЫЛКИ НА ОПУБЛИКОВАННЫЙ CSV ===
// ======================================================================================

// URL-адрес CSV для листа "Target" (должен быть получен через Файл -> Опубликовать в интернете)
const TARGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=1172056164&single=true&output=csv';

// URL-адрес CSV для листа "Лист16" (должен быть получен через Файл -> Опубликовать в интернете)
const SALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQanJbjk5hOpz8tnYmIm_zhrSQrAS8mZXzlCcUbQMrMdJ0BJ17cuXjlegDAUK7Nequl8tu2JWpznwFE/pub?gid=407492630&single=true&output=csv';

function cleanGroup(groupName) {
    if (!groupName) return '';
    
    // Список известных сокращений
    const knownGroups = ['IN', 'NCF', 'CNF', 'PF', 'CPW', 'DAIRY', 'CLN', 'WATER', 'CSD', 'ICE'];
    
    // 1. Убираем всё, что после скобок или тире, и переводим в верхний регистр.
    let cleaned = groupName.toUpperCase()
                           .split('(')[0]
                           .split('-')[0]
                           .trim();
                           
    // 2. Исключаем чисто числовые строки (например, '024').
    if (/^\d+$/.test(cleaned) || cleaned === '') {
        return ''; 
    }
                           
    // 3. Ищем известное сокращение в очищенной строке.
    const parts = cleaned.split(/\s+/); 
    for (const part of parts) {
        if (knownGroups.includes(part)) {
            return part; 
        }
    }
    
    // 4. Если не найдено, возвращаем первое слово, если оно короткое.
    if (parts.length > 0 && parts[0].length > 1 && parts[0].length <= 5) {
        return parts[0]; 
    }
    
    return cleaned; 
}


// Парсинг и агрегация для ЛИСТА16 (Продажи)
// Столбцы: ШипДате, Group(1), Class, Номенклатура.Парент, USD(4)
function parseSalesCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedSales = {};

    // Надежное определение разделителя: проверяем, что чаще встречается в первой строке данных
    const separator = (lines.length > 1 && lines[1].split(';').length > 1) ? ';' : ','; 

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(separator);
        
        if (row.length < 5) continue;

        const rawGroup = row[1] ? row[1].trim() : ''; 
        const group = cleanGroup(rawGroup);
        
        let usdValue = row[4] ? row[4].trim() : '0';
        
        // Очистка и преобразование USD в число
        usdValue = parseFloat(usdValue.replace(/['"₽$,]/g, '').replace(/\s/g, ''));
        
        if (group && !isNaN(usdValue)) {
            aggregatedSales[group] = (aggregatedSales[group] || 0) + usdValue;
        }
    }
    return aggregatedSales; 
}


// Парсинг и агрегация для ЛИСТА Target
// Столбцы: Парент, Class, Group(2), USD(3)
function parseTargetCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const aggregatedTarget = {};

    // Надежное определение разделителя
    const separator = (lines.length > 1 && lines[1].split(';').length > 1) ? ';' : ','; 
    
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(separator);
        
        if (row.length < 4) continue;

        const rawGroup = row[2] ? row[2].trim() : '';
        const group = cleanGroup(rawGroup);
        
        let usdValue = row[3] ? row[3].trim() : '0';

        // Очистка и преобразование USD (обрабатываем русские числа: 2 998,55 -> 2998.55)
        usdValue = usdValue.replace(/\./g, '').replace(/,/g, '.'); 
        usdValue = parseFloat(usdValue.replace(/['"₽$]/g, '').replace(/\s/g, ''));
        
        if (group && !isNaN(usdValue)) {
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

// ... (остальной код до fetchData)

async function fetchData() {
    // ... (весь код проверки URL и загрузки CSV остается прежним)
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

        // --- Парсинг и агрегация по ГРУППАМ ---
        const targetsByGroup = parseTargetCSV(targetCSV);
        const salesByGroup = parseSalesCSV(salesCSV);
        const combinedDataByGroup = combineData(targetsByGroup, salesByGroup);
        processData(combinedDataByGroup); // Обработка ГРУПП (как раньше)
        
        // --- НОВАЯ ОБРАБОТКА по ТЕРРИТОРИЯМ ---
        const combinedDataByTerritory = aggregateByTerritory(targetCSV, salesCSV);
        processTerritoryData(combinedDataByTerritory); // НОВАЯ функция

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

// ======================================================================================
// === Агрегация и обработка данных по ТЕРРИТОРИЯМ ===
// ======================================================================================

// Агрегация данных Target и Sales по полю Class (которое содержит Territory)
// ======================================================================================
// === Агрегация и обработка данных по ТЕРРИТОРИЯМ (ИСПРАВЛЕННЫЕ ИНДЕКСЫ) ===
// ======================================================================================

// Агрегация данных Target и Sales по полю Territory (Class)
function aggregateByTerritory(targetCSV, salesCSV) {
    const linesTarget = targetCSV.split('\n').filter(line => line.trim() !== '');
    const linesSales = salesCSV.split('\n').filter(line => line.trim() !== '');
    
    const targetsByTerritory = {};
    const salesByTerritory = {};
    
    const separatorTarget = (linesTarget.length > 1 && linesTarget[1].split(';').length > 1) ? ';' : ','; 
    const separatorSales = (linesSales.length > 1 && linesSales[1].split(';').length > 1) ? ';' : ','; 

    // Парсинг Target: Парент(0), Class(1) [Territory], Group(2), USD(3)
    // ТЕРРИТОРИЯ находится в столбце Class (индекс 1)
    for (let i = 1; i < linesTarget.length; i++) {
        const row = linesTarget[i].split(separatorTarget);
        if (row.length < 4) continue;

        // ИНДЕКС 1 для Target
        const territory = row[1] ? row[1].trim() : ''; 
        let usdValue = row[3] ? row[3].trim() : '0';
        
        usdValue = usdValue.replace(/\./g, '').replace(/,/g, '.'); 
        usdValue = parseFloat(usdValue.replace(/['"₽$]/g, '').replace(/\s/g, ''));
        
        if (territory && !isNaN(usdValue)) {
            targetsByTerritory[territory] = (targetsByTerritory[territory] || 0) + usdValue;
        }
    }
    
    // Парсинг Sales: ШипДате(0), Group(1), Class(2) [Territory], Номенклатура.Парент, USD(4)
    // ТЕРРИТОРИЯ находится в столбце Class (индекс 2)
    for (let i = 1; i < linesSales.length; i++) {
        const row = linesSales[i].split(separatorSales);
        if (row.length < 5) continue;

        // ИНДЕКС 2 для Sales
        const territory = row[2] ? row[2].trim() : ''; 
        let usdValue = row[4] ? row[4].trim() : '0';
        
        usdValue = parseFloat(usdValue.replace(/['"₽$,]/g, '').replace(/\s/g, ''));
        
        if (territory && !isNaN(usdValue)) {
            salesByTerritory[territory] = (salesByTerritory[territory] || 0) + usdValue;
        }
    }

    // Объединение данных по Territory
    return combineData(targetsByTerritory, salesByTerritory);
}

// Построение таблицы и графиков по территориям
function processTerritoryData(combinedData) {
    let totalTarget = 0;
    let totalSales = 0;
    
    const tableBody = document.getElementById('territory-table-body');
    tableBody.innerHTML = ''; 

    const pieLabels = [];
    const pieTargetData = [];
    const pieSalesData = [];
    
    // Сортируем по Target
    const sortedTerritories = Object.keys(combinedData).sort((a, b) => {
        return combinedData[b].target - combinedData[a].target;
    });

    for (const territory of sortedTerritories) {
        const item = combinedData[territory];
        const target = Number(item.target) || 0;
        const sales = Number(item.sales) || 0;
        
        const execution = (target === 0) ? 0 : sales / target;
        const difference = target - sales;

        totalTarget += target;
        totalSales += sales;

        // Таблица
        const row = document.createElement('tr');
        const percentClass = getPercentClass(execution);

        row.innerHTML = `
          <td>${territory}</td>
          <td class="align-right">${formatNumber(target)}</td>
          <td class="align-right">${formatNumber(sales)}</td>
          <td class="align-right ${percentClass}">${formatPercent(execution)}</td>
          <td class="align-right">${formatNumber(difference)}</td>
        `;
        tableBody.appendChild(row);
        
        // Для графиков
        pieLabels.push(territory);
        pieTargetData.push(target);
        pieSalesData.push(sales);
    }

    // Обновление Итогов
    const totalExecution = (totalTarget === 0) ? 0 : totalSales / totalTarget;
    const totalDifference = totalTarget - totalSales;

    document.getElementById('territory-footer-target').textContent = formatNumber(totalTarget);
    document.getElementById('territory-footer-sales').textContent = formatNumber(totalSales);
    document.getElementById('territory-footer-percent').textContent = formatPercent(totalExecution);
    document.getElementById('territory-footer-percent').className = getPercentClass(totalExecution);
    document.getElementById('territory-footer-diff').textContent = formatNumber(totalDifference);
    
    // Рендеринг круговых диаграмм
    renderPieChart('targetPieChart', pieLabels, pieTargetData, 'Target');
    renderPieChart('salesPieChart', pieLabels, pieSalesData, 'Sales');
}

// Новая функция для рендеринга круговых диаграмм (Doughnut Chart)
function renderPieChart(canvasId, labels, data, title) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Уничтожаем старый график, если он существует
    if (window[canvasId] instanceof Chart) {
        window[canvasId].destroy(); 
    }
    
    window[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                backgroundColor: [
                    '#36A2EB', '#FF6384', '#FF9F40', '#4BC0C0', '#9966FF', '#FFCD56', '#C9CBCE'
                ],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            // Показываем сумму и процент
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const currentValue = context.raw;
                            const percentage = parseFloat((currentValue / total * 100).toFixed(1));
                            return `${label} ${formatNumber(currentValue)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

setInterval(fetchData, 60000);
