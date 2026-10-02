// Site analytics (GoatCounter): page views, outbound link clicks and form sends.
// Dashboard: https://madebyformat.goatcounter.com
// No cookies, so no consent banner is needed. Visits from localhost are not counted.
(function(){
  var CODE='madebyformat';
  var s=document.createElement('script');
  s.async=true;
  s.src='https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter','https://'+CODE+'.goatcounter.com/count');
  document.head.appendChild(s);

  // track('name') records an event; it waits for count.js if it hasn't loaded yet
  var queue=[];
  window.track=function(name,title){
    var e={path:name,title:title||name,event:true};
    if(window.goatcounter&&window.goatcounter.count)window.goatcounter.count(e);else queue.push(e);
  };
  s.onload=function(){queue.forEach(function(e){window.goatcounter.count(e)});queue=[]};

  // clicks on links to other sites, e.g. "outbound/instagram.com"
  document.addEventListener('click',function(ev){
    var a=ev.target.closest&&ev.target.closest('a[href]');
    if(!a||a.host===location.host||!/^https?:/.test(a.protocol))return;
    window.track('outbound/'+a.host.replace(/^www\./,''),a.href);
  },true);
})();
