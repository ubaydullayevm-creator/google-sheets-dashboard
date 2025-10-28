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
                           .split('(')[0] // Убираем (Bonus), (NonBonus)
                           .split('-')[0] // Убираем префиксы типа 024-1
                           .trim();
                           
    // 2. Исключаем чисто числовые строки (например, '024'). ЭТО ИСПРАВЛЕНИЕ ДЛЯ '024'.
    if (/^\d+$/.test(cleaned) || cleaned === '') {
        return ''; 
    }
                           
    // 3. Ищем известное сокращение в очищенной строке.
    const parts = cleaned.split(/\s+/); 
    for (const part of parts) {
        if (knownGroups.includes(part)) {
            return part; // Возвращаем найденное сокращение
        }
    }
    
    // 4. Если не найдено, возвращаем первое слово, если оно короткое (для новых групп).
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

    const separator = lines[0].includes(';') ? ';' : ',';

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(separator);
        
        if (row.length < 5) continue;

        const rawGroup = row[1] ? row[1].trim() : ''; // Столбец Group (индекс 1)
        const group = cleanGroup(rawGroup); // <-- Очистка группы
        
        let usdValue = row[4] ? row[4].trim() : '0'; // Столбец USD (индекс 4)
        
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

    const separator = lines[0].includes(';') ? ';' : ',';
    
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(separator);
        
        if (row.length < 4) continue;

        const rawGroup = row[2] ? row[2].trim() : ''; // Столбец Group (индекс 2)
        const group = cleanGroup(rawGroup); // <-- Очистка группы
        
        let usdValue = row[3] ? row[3].trim() : '0'; // Столбец USD (индекс 3)

        // Очистка и преобразование USD (заменяем запятые на точки, убираем пробелы)
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

async function fetchData() {
    if (TARGET_CSV_URL.includes('СЮДА_ВСТАВЬТЕ')) {
        alert('Ошибка! Пожалуйста, обновите URL-адреса в файле script.js.');
        return;
    }
    
    try {
        const [targetResponse, salesResponse] = await Promise.all([
            fetch(TARGET_CSV_URL),
            fetch(SALES_CSV_URL)
        ]);
        
        if (!targetResponse.ok || !salesResponse.ok) {
             throw new Error('Ошибка сети при загрузке CSV. Проверьте ссылки и настройки публикации.');
        }

        const targetCSV = await targetResponse.text();
        const salesCSV = await salesResponse.text();

        const targets = parseTargetCSV(targetCSV);
        const sales = parseSalesCSV(salesCSV);
        
        // Объединение данных по ключу Group
        const combinedData = combineData(targets, sales);

        processData(combinedData);

    } catch (error) {
        console.error('Не удалось загрузить или обработать данные:', error);
        alert(`Ошибка! Не удалось загрузить или обработать данные. Сообщение: ${error.message}`);
    }
}

// Объединение данных из двух объектов в один
function combineData(targets, sales) {
    const combined = {};
    const allGroups = new Set([...Object.keys(targets), ...Object.keys(sales)]);

    allGroups.forEach(group => {
      // Игнорируем пустые или невалидные названия групп
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
    
    // Сортируем группы по Target
    const sortedGroups = Object.keys(combinedData).sort((a, b) => {
        return combinedData[b].target - combinedData[a].target;
    });

    for (const group of sortedGroups) {
        const item = combinedData[group];
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
          <td>${group}</td>
          <td class="align-right">${formatNumber(target)}</td>
          <td class="align-right">${formatNumber(sales)}</td>
          <td class="align-right ${percentClass}">${formatPercent(execution)}</td>
          <td class="align-right">${formatNumber(difference)}</td>
        `;
        tableBody.appendChild(row);
        
        // Для графика
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

setInterval(drawChart, 60000); // Обновление каждые 60 секунд
