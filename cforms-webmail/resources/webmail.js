
function Throbber() {
	this._running = false;
};
Throbber.prototype = {
	text : "Please Wait",
	start : function() {
		if(!this._running) {
			this.element = document.createElement("div");
			this.element.className = "throbber";
			this.element.appendChild(document.createTextNode(this.text));
			document.body.appendChild(this.element);
			this._running = true;
			this.animate();
			new OpacityFader(this.element).animate();
		}
	},
	_dots : 0,
	animate : function() {
		if(this._running) {
			this._dots++;
			if(this._dots > 3) {
				this._dots = 0;
				this.element.firstChild.nodeValue = this.text;
			} else {
				this.element.firstChild.nodeValue += ".";
			}
			var thisRef = this;
			setTimeout(function(){thisRef.animate();}, 200);
		}
	},
	stop : function() {
		if(this._running) {
			document.body.removeChild(this.element);
			this._running = false;
		}
	}
};
Throbber.getInstance = function() { //singleton
	if(Throbber._instance == null) {
		Throbber._instance = new Throbber();
	}
	return Throbber._instance;
};



function OpacityFader(elt) {
	this.element = elt;
	this.step = 10;
	this.fps = 10;
	this.opacity = 0;
};
OpacityFader.prototype = {
	animate : function() {
		this.element.style.opacity = this.element.style.MozOpacity = this.opacity / 100;
		this.element.style.filter = "alpha(opacity=" + this.opacity + ")"; //MSIE
		if(this.opacity < 100) {
			var thisRef = this;
			setTimeout(function(){thisRef.animate();}, 1000 / this.fps);
		}
		this.opacity += this.step;
	}
};

// Override the form submit function to add functionality:
CForms._origSubmitForm = CForms.submitForm;
forms_submitForm = CForms.submitForm = function(element, name) {
	// Start the activity indicator:
	Throbber.getInstance().start();
	CForms._origSubmitForm(element, name);
};

// Override the browser-update processing function to add functionality:
BrowserUpdate._origProcessResponse = BrowserUpdate.processResponse;
BrowserUpdate.processResponse = function(doc, request) {
	// Kill the activity indicator:
	Throbber.getInstance().stop();
	BrowserUpdate._origProcessResponse(doc, request);
};


// Set automatic refresh interval:
setInterval("forms_submitForm(document.getElementById('refreshFolderList'), 'refreshFolderList');", 300000);


function toggleAllCheckboxes(inElt) {
	var inputs = inElt.getElementsByTagName("input");
	var hasUnchecked = false;
	for(var i=0; i<inputs.length; i++) {
		if(inputs[i].type == "checkbox") {
			if(!inputs[i].checked) hasUnchecked = true;
		}
	}
	for(var i=0; i<inputs.length; i++) {
		if(inputs[i].type == "checkbox") {
			inputs[i].checked = hasUnchecked;
		}
	}
}