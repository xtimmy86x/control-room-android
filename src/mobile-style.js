import mobileCss from './mobile-final.css?inline';

const style = document.createElement('style');
style.id = 'control-room-mobile-final';
style.textContent = mobileCss;
document.head.append(style);
