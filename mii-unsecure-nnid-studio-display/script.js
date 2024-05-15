const nnidInput = document.getElementById('nnidInput');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');
const errorDetails = document.getElementById('errorDetails');
const loadedDiv = document.getElementById('loaded');
const loadedName = document.getElementById('loadedName');
const loadedUserId = document.getElementById('loadedUserId');
const miiImage = document.getElementById('miiImage');
const miiForm = document.getElementById('miiForm');

let timeout = null;

function showStatus() {
  statusDiv.classList.remove('hidden');
  errorDiv.classList.add('hidden');
  loadedDiv.classList.add('hidden');
  statusDiv.classList.remove('error', 'success');
}

function showError(message) {
  errorDetails.textContent = message;
  errorDiv.classList.remove('hidden');
  statusDiv.classList.add('hidden');
  loadedDiv.classList.add('hidden');
  errorDiv.classList.add('error');
}

function showLoaded(name, userId, urlData) {
  loadedName.textContent = name;
  loadedUserId.textContent = userId;
  loadedDiv.classList.remove('hidden');
  statusDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');
  loadedDiv.classList.add('success');
  miiImage.src = miiImage.getAttribute('data-src') + urlData;
  miiImage.alt = name;
  miiImage.classList.remove('hidden');
}

function fetchData() {
  if (!nnidInput.checkValidity()) {
	  nnidInput.reportValidity();
    //showError(" Invalid NNID. Please use up to 16 alphanumeric characters, '.', '_', or '-'.");
    return;
  }

  const inputValue = nnidInput.value;
  const urlQuery = new URLSearchParams(new FormData(miiForm)).toString();
  const apiUrl = miiForm.action + inputValue
  + (urlQuery != '' ? '?' + urlQuery : '');

  fetch(apiUrl)
    .then(response => response.text().then(text => {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text);
    }
  }))
    .then(data => {
    if (data.error) {
      showError(data.error);
    } else {
      showLoaded(data.name, data.user_id, data.studio_url_data);
    }
  })
    .catch(error => {
    showError(error.message);
  });
}

nnidInput.addEventListener('keydown', () => {
  clearTimeout(timeout);
  timeout = setTimeout(fetchData, 500);
});

miiForm.addEventListener('submit', event => {
  event.preventDefault();
  fetchData();
});