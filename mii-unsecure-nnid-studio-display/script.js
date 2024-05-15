let timeout = null;

document.getElementById('miiInput').addEventListener('keydown', () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    const inputValue = document.getElementById('miiInput').value;
    fetch(`https://mii-unsecure.ariankordi.net/mii_data/${inputValue}`)
      .then(response => response.json())
      .then(data => {
      if (data.error) {
        document.getElementById('status').textContent = `Error: ${data.error}`;
        document.getElementById('status').classList.add('error');
        document.getElementById('status').classList.remove('success');
        document.getElementById('imageContainer').innerHTML = '';
      } else {
        document.getElementById('status').textContent = `Loaded: ${data.name} / ${data.user_id}`;
        document.getElementById('status').classList.add('success');
        document.getElementById('status').classList.remove('error');
        const imageUrl = `https://studio.mii.nintendo.com/miis/image.png?type=face&expression=normal&width=270&data=${data.studio_url_data}`;
        document.getElementById('imageContainer').innerHTML = `<img src="${imageUrl}" alt="${data.name}">`;
      }
    })
      .catch(error => {
      document.getElementById('status').textContent = `Error: ${error.message}`;
      document.getElementById('status').classList.add('error');
      document.getElementById('status').classList.remove('success');
      document.getElementById('imageContainer').innerHTML = '';
    });
  }, 400);
});