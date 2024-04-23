function fadeIn(element) {
  element.style.opacity = "1";
}

function fadeOut(element) {
  element.style.opacity = "0";
}

function toggleElements() {
  const video = document.getElementById("myVideo");
  const image = document.querySelector("#videoContainer img");

  fadeIn(video);
  video.play();
  fadeOut(image);

  setTimeout(() => {
    fadeOut(video);
    fadeIn(image);
  }, 2000); // Adjust the timeout value to control the time between transitions
}

// Initial call to start the transitions
toggleElements();

// Repeat the transitions every 3 seconds
setInterval(toggleElements, 3000);
