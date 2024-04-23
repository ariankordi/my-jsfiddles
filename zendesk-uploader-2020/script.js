var uploadForm = document.getElementById('upload-form');
var uploadFile = document.getElementById('upload-file');
var uploadButton = document.getElementById('upload-button');

var outputPre = document.getElementsByTagName('pre')[0];

const submitUploadForm = event => {
	event.preventDefault();

	var req = new XMLHttpRequest();
  req.open('POST', uploadForm.action);
  // lol who cares
	req.setRequestHeader('Content-Type', 'image/png');


	// when response is received
  req.addEventListener('load', () => {
  	// enable button
  	uploadButton.removeAttribute('disabled');
    // change upload button text back to normal
    uploadButton.value = 'upload';
  
  	let parsedResponse = JSON.parse(req.response);
  	let contentURL = parsedResponse.upload.attachments[0].mapped_content_url;
    // only keep content leading to question mark
    contentURL = contentURL.split('/?')[0];
    outputPre.innerHTML += '<br>' +
    '<a href="' + contentURL + '">' + contentURL + '</a>';
  });

  req.send(uploadFile.files[0]);
  // make button gray
  uploadButton.setAttribute('disabled', true);
  // change upload button text
  uploadButton.value = 'loading...';
}

uploadForm.addEventListener('submit', submitUploadForm);