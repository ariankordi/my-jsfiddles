// Select elements based on their names and ids
var resolutionNumber = document.getElementById('resolution-number');
var widthSlider = document.getElementsByName('width')[0];
var bgColor = document.getElementsByName('bgColor')[0];
var transparentCheckbox = document.getElementById('transparent-checkbox');

var bgDefault = '#00ff00'//bgColor.value;

// Update the width slider when the resolution number is changed
resolutionNumber.addEventListener('input', function() {
    widthSlider.value = this.value;
});

// Update the resolution number when the width slider is changed
widthSlider.addEventListener('input', function() {
    resolutionNumber.value = this.value;
});

// When the transparent-checkbox is checked, change the background color to #00ff00
transparentCheckbox.addEventListener('change', function() {
    if(this.checked) {
        bgColor.value = bgDefault;
        this.disabled = true;
    } else if(bgColor.value === bgDefault) {
        // TODO: you may consider changing bg by one
        // so you can still have a green background
        this.checked = true;
        this.disabled = true;
    }
});

// When the background color is changed to #00ff00, check the transparent-checkbox
// Note: This also unchecks the checkbox if the color is changed to anything other than #00ff00
bgColor.addEventListener('input', function() {
    if (this.value.toLowerCase() === bgDefault) {
        transparentCheckbox.checked = true;
        transparentCheckbox.disabled = true;
    } else {
        transparentCheckbox.checked = false;
        transparentCheckbox.disabled = false;
    }
});

var scaleInput = document.getElementsByName('scale')[0];
var realMax = 1080;
// Function to update max resolution based on scale
function updateMaxResolution() {
    var scale = parseInt(scaleInput.value);
    var maxResolution = realMax / scale;

    // Adjust current values if they exceed the new max
    if (widthSlider.value > maxResolution) {
        widthSlider.value = maxResolution;
        //debugger;
        resolutionNumber.value = maxResolution;
    }
    
    widthSlider.max = maxResolution;
    resolutionNumber.max = maxResolution;
}

// Listen for changes in the scale input to update max resolution
scaleInput.addEventListener('input', updateMaxResolution);

// Initial setup - apply the correct maximums based on the initial scale value
updateMaxResolution();


var form = document.forms[0];
var resultList = document.getElementById('results');

form.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent the default form submission via HTTP

  var submitButton = form.querySelector('input[type=submit]');
  submitButton.disabled = true; // Disable the button
  submitButton.setAttribute('value-disabled', submitButton.value); // Change "value" key to "value-disabled"

  // Encode form data into GET parameters
  var formData = new FormData(form);
  var params = new URLSearchParams(formData).toString();
  var imageUrl = `http://192.168.2.20:8080/image.png?${params}`;

  // Create and append the <img> element
  var img = document.createElement('img');
  img.src = imageUrl;
  img.onerror = function() {
    // Handle image loading error
    var errorLi = document.createElement('li');
    errorLi.textContent = 'Error loading image';
    errorLi.style.color = 'red';
    resultList.insertBefore(errorLi, resultList.firstChild); // Insert at the top
    submitButton.disabled = false; // Re-enable the button
    submitButton.removeAttribute('value'); // Revert "value-disabled" to "value"
  };
  img.onload = function() {
    // Re-enable the button upon successful image load
    submitButton.disabled = false;
    submitButton.removeAttribute('value'); // Revert "value-disabled" to "value"
  };

  // Insert the new <li> at the top of the list
  var li = document.createElement('li');
  li.appendChild(img); // Append the <img> to the <li>
  resultList.insertBefore(li, resultList.firstChild);
});