// Copyright (c) Pascal Brand
// MIT License
//
// Initial version from https://github.com/JumiDeluxe/SMS-XML-backup-reader

import Message from './message.mjs'

class SMS extends Message {
    constructor(message) {
        super(message);
    }

    displayText() {
        let textContainer = document.createElement("div");
        textContainer.className = "textContainer";

        let textMessage = this.attributes['body'];
        if(typeof textMessage === 'undefined') {
            textMessage = this.attributes['text'];

        }

        let textnode = document.createTextNode(textMessage['nodeValue']);
        textContainer.appendChild(textnode);

        this.messageContainer.appendChild(textContainer);
    }

    getMessage() {
        this.displayInfo();
        this.displayText();
        //document.getElementById('container').appendChild(this.messageContainer);
        return [this.address, this.timestamp, this.messageContainer];
    }

}

export default SMS
