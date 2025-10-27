// 🟡 ВАЖНО: используй ссылку в формате /gviz/tq?tqx=out:csv
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/15nF9Oz9uI4aY7pf7LJ2IXmWkQrVcVVUT/gviz/tq?tqx=out:csv';

async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  return text;
}

function parseCSV(data) {
  const lines = data.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return Object.fromEntries(values.map((v, i) => [headers[i], v.trim()]));
  });
}

async function drawChart() {
  try {
    const csv = await fetchCSV(SHEET_URL);
    const data = parseCSV(csv);

    // ⚙️ Предполагаем, что столбцы называются "Дата" и "Значение"
    const labels = data.map(row => row['name']);
    const values = data.map(row => parseFloat(row['usd']));

    const ctx = document.getElementById('myChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Значение',
          data: values,
          borderColor: 'blue',
          tension: 0.2,
          fill: false
        }]
      },
      options: {
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

// Рисуем сразу
drawChart();

// Обновляем каждые 60 сек
setInterval(drawChart, 60000);
