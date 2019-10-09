class FurnaceSplitJournal extends FormApplication {
    constructor(object, options) {
        super(object, options);

        this.splitters = {}
        this.useSplitter = null
        this.content = null
        if (object.data.content != "") {
            this.content = $("<div>" + object.data.content + "</div>")
            let try_splitters = {
                "h1": "Heading 1",
                "h2": "Heading 2",
                "h3": "Heading 3",
                "h4": "Heading 4",
                "h5": "Heading 5",
                "h6": "Heading 6",
                "h7": "Heading 7"
            }

            for (let splitter in try_splitters) {
                let parts = this.content.find(splitter)
                if (parts.length > 0) {
                    this.splitters[splitter] = try_splitters[splitter]
                    if (this.useSplitter == null && parts.length > 1)
                        this.useSplitter = splitter
                }
            }
        }
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "split-journal";
        options.title = "Split Journal";
        options.classes = ["sheet"];
        options.template = "public/modules/furnace/templates/split-journal.html";
        options.width = 400;
        options.height = "auto";
        return options;
    }

    /* -------------------------------------------- */


    /* -------------------------------------------- */

    async getData() {
        let error = false
        let errorMessage = ""
        let newEntries = []
        if (this.content) {
            if (this.useSplitter == null && this.splitters.length > 0)
                this.useSplitter = this.splitters[0]
            if (this.useSplitter == null) {
                error = true;
                errorMessage = "<strong>This Journal entry had no headings.</strong><p>Create headings in your journal then try again</p>";
            } else {
                let parts = this.content.find(this.useSplitter)
                newEntries = $.map(parts, h => h.textContent)
            }
        } else {
            error = true;
            errorMessage = "<strong>This Journal entry is empty.</strong><p>There is nothing to split</p>";
        }
        return {
            name: this.object.name,
            splitters: this.splitters,
            useSplitter: this.useSplitter,
            newEntries: newEntries,
            hasImage: this.object.data.img != "",
            error: error,
            errorMessage: new Handlebars.SafeString(errorMessage),
            submitText: error ? "OK" : "Split Journal"
        }
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find("select[name=splitter]").change(async (ev) => {
            this.useSplitter = html.find("select[name=splitter]").val()
            await this.render(true)
        })
    }

    async _updateObject(event, formData) {
        if (!this.content || !this.useSplitter) return;

        let folder = game.folders.get(this.object.data.folder);
        console.log("Form data : ", formData);
        if (formData.newFolder) {
            let parent = folder;
            let folderDepth = 0;
            while (parent !== undefined) {
                folderDepth++;
                parent = game.folders.get(parent.data.parent)
            }
            console.log("Splitting Journal entry : ", this.object.name, "with depth : ", folderDepth);

            if (folderDepth >= 3)
                parent = folder.data.parent;
            else
                parent = folder;
            let folderData = {
                name: this.object.name,
                type: "JournalEntry",
                parent: parent.id
            }
            folder = await Folder.create(folderData)
        }
        let parts = splitHtml(this.content, formData.splitter)
        let header = ""
        for (let idx = 0; idx < parts.length; idx++) {

            let name = this.object.name
            let content = parts[idx];

            if (idx == 0) {
                name = "Header"
                header = content.trim();
                if (header == "" || formData.separateHeader)
                    continue;
            } else {
                name = $(parts[idx]).text()
                content += parts[++idx]
                if (formData.separateHeader)
                    content = header + content;
            }
            let img = ""
            if (formData.includeImage)
                img = this.object.data.img
            let journalData = {
                "name": name,
                "permission": this.object.data.permission,
                "flags": { "entityorder": { "order": idx * 100000 } },
                "folder": folder.id,
                "entryTime": this.object.data.entryTime,
                "img": img,
                "content": content
            }
            await JournalEntry.create(journalData, { displaySheet: false })
        }
    }

    /* Recursively add nodes until we find the index element we want */
    extractContent(splitter, idx) {
        let content = ""
        for (let node of this.content[0].childNodes) {
            let found = node.nodeName == splitter.toUpperCase || $(node).find(splitter)
            if (found && idx > 0) {

            }
            if (idx == 0) {

            }
        }
        return content;
    }
    static getEntryContext(html, options) {
        options.push({
            name: "Split Journal",
            icon: '<i class="fas fa-list-ul"></i>',
            condition: game.user.isGM,
            callback: header => {
                let entityId = header.attr("data-entity-id");
                let entity = game.journal.get(entityId);
                new FurnaceSplitJournal(entity).render(true);

            }
        })
    }
}

Hooks.on('getJournalDirectoryEntryContext', FurnaceSplitJournal.getEntryContext);