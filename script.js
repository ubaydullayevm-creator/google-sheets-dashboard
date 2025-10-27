const SHEET_URL = 'https://docs.google.com/spreadsheets/d/{ID}/export?format=csv';

async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  return text;
}

function parseCSV(data) {
  const lines = data.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  const result = lines.slice(1).map(line => {
    const values = line.split(',');
    return Object.fromEntries(values.map((v, i) => [headers[i], v]));
  });
  return result;
}

async function drawChart() {
  const csv = await fetchCSV(SHEET_URL);
  const data = parseCSV(csv);

  // Пример: Предполагаем, что в таблице есть столбцы "Дата" и "Значение"
  const labels = data.map(row => row['Дата']);
  const values = data.map(row => parseFloat(row['Значение']));

  const ctx = document.getElementById('myChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Значение',
        data: values,
        borderColor: 'blue',
        fill: false
      }]
    }
  });
}

drawChart();

// Обновление каждые 60 секунд:
setInterval(drawChart, 60000);
