cocoon.load("resource://org/apache/cocoon/forms/flow/javascript/Form.js");

// Create cocoon.exit() method (added in SVN, making sure it's available):
cocoon.exit = new Continuation();

// Some patchwork to add support for multiple bindings per form:
Form.prototype._orig_createBinding = Form.prototype.createBinding;
Form.prototype.createBinding = function(bindingURI) {
	this._orig_createBinding(bindingURI);
	return this.binding;
};
Form.prototype._orig_load = Form.prototype.load;
Form.prototype.load = function(obj, binding) {
	if(binding != null) this.binding = binding;
	this._orig_load(obj);
};
Form.prototype._orig_save = Form.prototype.save;
Form.prototype.save = function(obj, binding) {
	if(binding != null) this.binding = binding;
	this._orig_save(obj);
};



// Session globals:
var store;

function webmail() {
	store = null;
	
	// Create the Form object and the bindings:
	var form = new Form("webmail.definition.xml");
	var folderListBinding = form.createBinding("webmail.folderlist.binding.xml");
	var messageListBinding = form.createBinding("webmail.messagelist.binding.xml");
	var messageDetailBinding = form.createBinding("webmail.messagedetail.binding.xml");
	
	// Method to display exceptions as a message:
	form.handleException = function(e) {
		form.lookupWidget("notifications").addMessage(e.message);
	};
	
	function StoreWrapper(store, session) {
		this.store = store;
		this.session = session;
	};
	StoreWrapper.prototype = {
		host : null,
		port : null,
		username : null,
		password : null,
		connect : function() {
			if(this.store.isConnected()) return;
			var success = false;
			var loginForm = null;
			while(!success) {
				if(this.host == null || this.port == null || this.username == null || this.password == null) {
					if(loginForm == null) {
						loginForm = new Form("login.definition.xml");
					}
					loginForm.showForm("login.display");
					this.host = loginForm.lookupWidget("host").value;
					this.port = loginForm.lookupWidget("port").value;
					this.username = loginForm.lookupWidget("username").value;
					this.password = loginForm.lookupWidget("password").value;
				}
				try {
					this.store.connect(this.host, this.username, this.password);
					success = true;
				}
				catch(e) {
					loginForm.lookupWidget("messages").addMessage(e.message);
					this.username = this.password = null;
				}
			}
		},
		
		folders : {}, //map of cached folder names to FolderWrapper objects
		getFolder : function(name) {
			var cached = this.folders[name];
			if(cached != null) return cached;
			this.connect();
			return this.folders[name] = new FolderWrapper(this.store.getFolder(name), this);
		},
		
		defaultFolder : null,
		getDefaultFolder : function() {
			if(this.defaultFolder == null) {
				this.connect();
				this.defaultFolder = new FolderWrapper(this.store.getDefaultFolder(), this);
			}
			return this.defaultFolder;
		},
		
		trashFolder : null,
		getTrashFolder : function() {
			if(this.trashFolder == null) {
				this.connect();
				this.trashFolder = this.getFolder("INBOX.Trash");
				if(this.trashFolder == null) { //try folder in root
					this.trashFolder = this.getFolder("Trash");
				}
			}
			return this.trashFolder;
		},
		
		selectedFolder : null,
		selectFolder : function(name) {
			this.selectedFolder = this.getFolder(name);
			this.selectedFolder.chunkStart = 1; //reset paging
			this.selectedFolder.displayMessages();
			
			// refresh folder list
			this.displayFolders();
		},
		
		displayFolders : function() {
			this.connect();
			var topFolder = this.getDefaultFolder();
			topFolder.refreshSubFolders();
			form.load(topFolder, folderListBinding);
		},
		
		folderSelectionList : [],
		refreshFolderSelectionList : function() {
			var thisRef = this;
			function addSubFolders(parentFolder, prefix) {
				for(var i=0, folder; (folder = parentFolder.subFolders[i]); i++) {
					thisRef.folderSelectionList.push({
						label : prefix + folder.folder.getName(),
						value : folder.folder.getFullName()
					});
					addSubFolders(folder, prefix + "\u00A0\u00A0"); // nbsp
				}
			}
			addSubFolders(this.getDefaultFolder(), "");
		}
	};
	
	function FolderWrapper(folder, store) {
		this.folder = folder;
		this.store = store;
		this.exists = (folder != null);
	};
	FolderWrapper.prototype = {
		chunkStart : 1,
		chunkEnd : 10,
		chunkSize : 10,
		
		messagesByUID : {},
		getMessageByUID : function(uid) {
			var cached = this.messagesByUID[uid];
			if(cached == null) {
				this.open();
				cached = this.messagesByUID[uid] = new MessageWrapper(this.folder.getMessageByUID(uid), this);
				this.close();
			}
			return cached;
		},
		
		chunkedMessages : [],
		updateChunkedMessages : function() {
			this.open();
			this.chunkedMessages = []; //reset
			
			var totalMsgs = this.folder.getMessageCount();
			this.chunkEnd = this.chunkStart + this.chunkSize - 1;
			if(this.chunkEnd > totalMsgs) this.chunkEnd = Number(totalMsgs);
			
			// get the chunk from the end of the folder, in reverse order.
			// (TODO: use IMAP SORT to do this instead.)
			var msgArray = this.folder.getMessages(totalMsgs+1 - this.chunkEnd, totalMsgs+1 - this.chunkStart); //subtract from total to get chunk from end of folder
			java.util.Collections.reverse(java.util.Arrays.asList(msgArray)); //reverse the order of items in that chunk so most recent is first
			
			// fetch message UIDs:
			var fetchProfile = new Packages.javax.mail.FetchProfile();
			fetchProfile.add(Packages.javax.mail.UIDFolder.FetchProfileItem.UID);
			this.folder.fetch(msgArray, fetchProfile);
			
			// get MessageWrapper objects for each UID:
			for(var i=0; i<msgArray.length; i++) {
				if(i in msgArray) {
					this.messages.push(this.getMessageByUID(this.folder.getUID(msgArray[i])));
				} else {
					this.messages.push(MessageWrapper.EMPTY_MESSAGE);
				}
			}
			this.close();
		},
		
		messages : [],
		displayMessages : function() {
			this.open(); //make sure we are opened
			this.messages = []; //reset
			
			var totalMsgs = this.folder.messageCount;
			this.chunkEnd = this.chunkStart + this.chunkSize - 1;
			if(this.chunkEnd > totalMsgs) this.chunkEnd = Number(totalMsgs);
			
			// get the chunk from the end of the folder, in reverse order.
			// (TODO: use IMAP SORT to do this instead.)
			var msgArray = this.folder.getMessages(totalMsgs+1 - this.chunkEnd, totalMsgs+1 - this.chunkStart); //subtract from total to get chunk from end of folder
			java.util.Collections.reverse(java.util.Arrays.asList(msgArray)); //reverse the order of items in that chunk so most recent is first
			this.folder.fetch(msgArray, FolderWrapper.messageListFetchProfile); //prefetch metadata to be displayed in list
			
			for(var i=0; i<this.chunkSize; i++) {
				if(i in msgArray) {
					var newMsg = new MessageWrapper(msgArray[i], this);
					this.messages.push(newMsg);
				} else {
					this.messages.push(MessageWrapper.EMPTY_MESSAGE);
				}
			}
			form.load(this, messageListBinding);
			this.close();
			
			// update prev/next button state:
			var ws = Packages.org.apache.cocoon.forms.formmodel.WidgetState;
			var prev = form.lookupWidget("messages/previous");
			var next = form.lookupWidget("messages/next");
			var prevTgtState = (this.chunkStart > 1) ? ws.ACTIVE : ws.INVISIBLE;
			var nextTgtState = (this.chunkStart < totalMsgs - this.chunkSize) ? ws.ACTIVE : ws.INVISIBLE
			if(prev.state != prevTgtState) prev.state = prevTgtState;
			if(next.state != nextTgtState) next.state = nextTgtState;
		},
		goPrevious : function() {
			this.chunkStart -= this.chunkSize;
			if(this.chunkStart < 1) this.chunkStart = 1;
			this.displayMessages();
		},
		goNext : function() {
			this.chunkStart += this.chunkSize;
			var last = this.folder.messageCount - 1;
			if(this.chunkStart > last) this.chunkStart = last;
			this.displayMessages();
		},
		
		selectedMessage : null,
		selectMessage : function(msgIdx) {
			this.open();
			this.selectedMessage = this.messages[msgIdx];
			this.selectedMessage.displayDetails();
			this.close();
			
			// enable the buttons:
			var ws = Packages.org.apache.cocoon.forms.formmodel.WidgetState;
			form.lookupWidget("message/delete").setState(ws.ACTIVE);
		},
		
		deleteSelectedMessages : function() {
			this.moveSelectedMessages(this.store.getTrashFolder());
		},
		
		moveSelectedMessages : function(toFolder) {
			this.open();
			
			var msgArrayList = new Packages.java.util.ArrayList();
			var repeater = form.lookupWidget("messages/list");
			for(var i=0; i<repeater.getSize(); i++) {
				var checkbox = repeater.getRow(i).getChild("isSelected");
				if(checkbox.getValue().booleanValue()) {
					msgArrayList.add(this.messages[i].message);
					checkbox.setValue(false); //uncheck
				}
			}
			var msgArray = msgArrayList.toArray(
				java.lang.reflect.Array.newInstance(Packages.javax.mail.Message, msgArrayList.size())
			);
			
			// copy to target folder:
			this.folder.copyMessages(msgArray, toFolder.folder);
			
			// set the DELETED flag
			var Flags = Packages.javax.mail.Flags;
			this.folder.setFlags(msgArray, new Flags(Flags.Flag.DELETED), true);
			this.close();
			
			// refresh message and folder list:
			this.displayMessages();
			this.store.displayFolders();
		},
		
		open : function() {
			store.connect(); // make sure we are connected
			if(!this.folder.isOpen()) { // open the folder if it's not already open
				this.folder.open(Packages.javax.mail.Folder.READ_WRITE);
				this.folder.expunge(); // auto-expunge
			}
		},
		close : function() {
			if(this.folder.isOpen()) {
				this.folder.close(true); //close and expunge
			}
		},
		
		sort : function(criterion, reverse) {
			var command = new JavaAdapter(
				Packages.com.sun.mail.imap.IMAPFolder.ProtocolCommand,
				{
					doCommand : function(protocol) {
						// Create arguments:
						var args = new Packages.com.sun.mail.imap.protocol.Arguments();
						var criteria = new Packages.com.sun.mail.imap.protocol.Arguments();
						if(reverse) {
							criteria.writeString("REVERSE");
						}
						criteria.writeString(criterion);
						args.writeArgument(criteria);
						args.writeString("UTF-8");
						args.writeString("ALL");
						
						// Issue command and get response:
						var responseLines = protocol.command("SORT", args);
						var response = responseLines[responseLines.length - 1];
						
						if(response.isOK()) {
							
						}
						
						/*
						// Issue command
						Argument args = new Argument();
						Argument list = new Argument();
						list.writeString("SUBJECT");
						args.writeArgument(list);
						args.writeString("UTF-8");
						args.writeString("ALL");
						Response[] r = p.command("SORT", args);
						Response response = r[r.length-1];
				
						// Grab response
						if (response.isOK()) { // command succesful 
						for (int i = 0, len = r.length; i < len; i++) {
							if (!(r[i] instanceof IMAPResponse))
							continue;
				
							IMAPResponse ir = (IMAPResponse)r[i];
							if (ir.keyEquals("SORT")) {
							String num;
							while ((num = ir.readAtomString()) != null)
								System.out.println(num);
							r[i] = null;
							}
						}
						}
				
						// dispatch remaining untagged responses
						p.notifyResponseHandlers(r);
						p.handleResult(response);
				
						return null;
						*/
					}
				}
			);
		},
		
		subFolders : [],
		refreshSubFolders : function() {
			this.subFolders = [];
			var subArray = this.folder.listSubscribed();
			for(var i=0; i<subArray.length; i++) {
				var sub = new FolderWrapper(subArray[i], this.store);
				this.subFolders.push(sub);
				sub.refreshSubFolders();
			}
		}
	};
	FolderWrapper.messageListFetchProfile = new Packages.javax.mail.FetchProfile();
	FolderWrapper.messageListFetchProfile.add(Packages.javax.mail.FetchProfile.Item.ENVELOPE);
	FolderWrapper.messageListFetchProfile.add(Packages.javax.mail.FetchProfile.Item.FLAGS);
	FolderWrapper.messageListFetchProfile.add(Packages.javax.mail.UIDFolder.FetchProfileItem.UID);
	FolderWrapper.messageListFetchProfile.add(Packages.com.sun.mail.imap.IMAPFolder.FetchProfileItem.SIZE);
	
	
	function MessageWrapper(message, folder) {
		this.message = message;
		this.folder = folder;
		this.parseEnvelope();
	};
	MessageWrapper.prototype = {
		selected : false,
		
		content : null,
		attachments : null,
		parseContent : function() {
			if(this.content != null) return; //only fetch once
			this.content = "";
			this.attachments = [];
			
			var thisRef = this;
			function doParse(part) {
				if(part.isMimeType("text/plain")) {
					try {
						thisRef.content += String(part.getContent()).replace(/  /g, " \u00A0");
					} catch(e) {
						thisRef.content += "[COULD NOT PARSE MESSAGE]: " + e.toString();
					}
				}
				else if(part.isMimeType("multipart/*")) {
					var multipart = part.getContent();
					for(var i=0; i < multipart.getCount(); i++) {
						doParse(multipart.getBodyPart(i));
					}
				}
				else {
					thisRef.attachments.push(part);
				}
			};
			doParse(this.message);
			
			if(this.content == "") this.content = "[ NO PLAINTEXT PARTS FOUND ]";
		},
		
		subject : null,
		sender : null,
		recipients : null, //{to : [], cc : []}
		size : null,
		parseEnvelope : function() {
			if(this.subject == null) {
				this.subject = this.message.subject || "(No Subject)";
			}
			if(this.sender == null) {
				var from = (this.message.from)[0];
				this.sender = from.personal || from.address;
			}
			if(this.recipients == null) {
				var rt = Packages.javax.mail.Message.RecipientType;
				var ia = Packages.javax.mail.internet.InternetAddress;
				this.recipients = {
					to : ia.toString(this.message.getRecipients(rt.TO)),
					cc : ia.toString(this.message.getRecipients(rt.CC)),
				};
			}
			if(this.size == null) {
				this.size = this.message.getSize();
				if(this.size == -1) this.size = null; //handle empty messages that return -1 for their size
			}
		},
		
		displayDetails : function() {
			this.folder.open();
			this.parseContent();
			form.load(this, messageDetailBinding);
			this.markAsRead();
			this.folder.close();
		},
		
		markAsRead : function() {
			this.folder.open();
			var seen = Packages.javax.mail.Flags.Flag.SEEN;
			if(!this.message.isSet(seen)) {
				this.message.setFlag(seen, true);
				this.folder.displayMessages(); //refresh message list...
				this.folder.store.displayFolders(); //...and folder list.
			}
			this.folder.close();
		},
		
		deleteMessage : function() {
			this.folder.open();
			
			// Copy to the Trash folder if we can find it:
			var trash = this.folder.store.getTrashFolder();
			if(trash.exists) {
				var msgArray = java.lang.reflect.Array.newInstance(Packages.javax.mail.Message, 1);
				msgArray[0] = this.message;
				this.folder.folder.copyMessages(msgArray, trash.folder);
			}
			
			// Set the DELETED flag on the message:
			this.message.setFlag(Packages.javax.mail.Flags.Flag.DELETED, true);
			this.folder.close(); //commits the change
		},
		
		displayAttachment : function(num) {
			this.folder.open();
			var part = this.attachments[num];
			var content = part.getContent();
			cocoon.sendPage("attachment", {content : content});
			this.folder.close();
			cocoon.exit();
		}
	};
	// fake MessageWrapper with empty properties - this is hackish, find a better way.
	MessageWrapper.EMPTY_MESSAGE = {message:{subject:null, from:[{personal:null, address:null}], receivedDate:null, size:null}, content:null, attachments:[], subject:null, sender:null, recipients:{to:null, cc:null}, size:null};
	
	// Log in to a mail Store if needed:
	if(store == null) {
		var props = new Packages.java.lang.System.getProperties();
		var session = Packages.javax.mail.Session.getInstance(props, null);
		store = new StoreWrapper(session.getStore("imap"), session);
	}
	store.connect();
	
	
	// Set handlers for form action events:
	var formHandler = new JavaAdapter(Packages.org.apache.cocoon.forms.event.AbstractFormHandler, {
		handleActionEvent : function(actionEvent) {
			try {
				// Listen for action events:
				switch(String(actionEvent.actionCommand)) {
					case "messageListNext":
						store.selectedFolder.goNext();
						break;
					
					case "messageListPrevious":
						store.selectedFolder.goPrevious();
						break;
						
					case "selectMessage":
						var msgIdx = actionEvent.source.parent.id; //index of the row
						store.selectedFolder.selectMessage(msgIdx);
						break;
						
					case "selectFolder":
						var folderName = actionEvent.source.lookupWidget("../fullName").value;
						store.selectFolder(folderName);
						break;
						
					case "refreshFolderList":
						store.displayFolders();
						break;
						
					case "deleteMessages":
						store.selectedFolder.deleteSelectedMessages();
						break;
						
					case "moveMessages":
						var targetFolder = store.getFolder(form.lookupWidget("messages/folderList").getValue());
						store.selectedFolder.moveSelectedMessages(targetFolder);
						break;
						
					case "deleteMessage":
						store.selectedFolder.selectedMessage.deleteMessage();
						store.selectedFolder.displayMessages();
						store.displayFolders();
						var ws = Packages.org.apache.cocoon.forms.formmodel.WidgetState;
						form.lookupWidget("message/delete").setState(ws.DISABLED);
						break;
						
					case "displayAttachment":
						var attachmentNum = actionEvent.source.getParent().getId(); //row index
						store.selectedFolder.selectedMessage.displayAttachment(attachmentNum);
						break;
				}
			} catch(e) {
				form.handleException(e);
			}
		},
		handleValueChangedEvent : function(valueChangedEvent) {}
	});
	form.form.setFormHandler(formHandler);
	
	// Perform initial data load:
	store.displayFolders();
	store.selectFolder("INBOX");
	
	// Set the folder selection list:
	store.refreshFolderSelectionList();
	form.lookupWidget("messages/folderList").setSelectionList(store.folderSelectionList, "value", "label");
	
	while(true) { //keep looping in case we accidentally exit
		form.showForm("webmail.display", store);
	}
};

