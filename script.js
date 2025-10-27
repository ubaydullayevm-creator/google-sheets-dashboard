// Ссылка на твой Google Sheets CSV (важно — формат gviz/tq?tqx=out:csv)
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

    // 🎯 Берём столбцы name и usd
    const labels = data.map(row => row['name']);
    const values = data.map(row => parseFloat(row['usd']));

    // 🎨 Генерация случайных цветов для каждого сегмента
    const colors = labels.map(() =>
      `hsl(${Math.random() * 360}, 70%, 60%)`
    );

    const ctx = document.getElementById('myChart').getContext('2d');
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          label: 'USD по каждому name',
          data: values,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Распределение USD по имени'
          }
        }
      }
    });

  } catch (err) {
    console.error('Ошибка загрузки:', err);
  }
}

// Рисуем сразу
drawChart();

// Обновляем каждые 60 сек
setInterval(drawChart, 60000);
