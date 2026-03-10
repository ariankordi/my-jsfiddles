const nnidInput = document.getElementById('nnidInput');
const pretendoToggle = document.getElementById('pretendoToggle');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');
const errorDetails = document.getElementById('errorDetails');
const loadedDiv = document.getElementById('loaded');
const loadedName = document.getElementById('loadedName');
const loadedUserId = document.getElementById('loadedUserId');
const miiImage = document.getElementById('miiImage');
const miiForm = document.getElementById('miiForm');
const randomFetchButton = document.getElementById('randomFetch');

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
  miiImage.src = `https://studio.mii.nintendo.com/miis/image.png?type=all_body&expression=normal&width=270&data=${urlData}`;
  miiImage.alt = name;
  miiImage.classList.remove('hidden');
}

function fetchData(apiUrl) {
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

function handleFormSubmit(event) {
  event && event.preventDefault();
  if (!nnidInput.checkValidity()) {
    showError("Invalid NNID. Please use up to 16 alphanumeric characters, '.', '_', or '-'.");
    return;
  }

  let formData = new FormData(miiForm);
  let apiUrl = miiForm.action + formData.get('nnid');
  if (pretendoToggle.checked) {
    apiUrl += `?api_id=1`;
  }

  fetchData(apiUrl);
}

nnidInput.addEventListener('keydown', () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    miiForm.dispatchEvent(new Event('submit'));
  }, 500);
});

miiForm.addEventListener('submit', handleFormSubmit);

randomFetchButton.addEventListener('click', () => {
  fetchData('https://mii-unsecure.ariankordi.net/mii_data_random');
});

handleFormSubmit();