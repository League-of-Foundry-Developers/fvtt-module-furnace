class FurnaceTokenQoL {
    static init() {
        game.settings.register("furnace", "tokenIgnoreVision", {
            name: "Ignore Token Vision for the GM",
            scope: "world",
            config: false,
            default: false,
            type: Boolean,
            onChange: value => {
                canvas.initializeSources()
            }
        });
    }
    static getSceneControlButtons(buttons) {
        let tokenButton = buttons.find(b => b.name == "token")

        if (tokenButton) {
            tokenButton.tools.push({
                name: "vision",
                title: "Ignore Token Vision",
                icon: "far fa-eye-slash",
                toggle: true,
                active: game.settings.get("furnace", "tokenIgnoreVision"),
                visible: game.user.isGM,
                onClick: (value) => game.settings.set("furnace", "tokenIgnoreVision", value)
            });
        }
    }
    static setup() {
        // Disable sight layer's token vision if GM and option enabled
        FurnacePatching.replaceGetter(SightLayer, 'tokenVision', function () {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision"))
                return false;
            return FurnacePatching.callOriginalGetter(this, "tokenVision");
        });

        // Drop Actor folder onto canvas
        FurnacePatching.replaceMethod(Canvas, "_onDrop", async function (event) {
            const ret = FurnacePatching.callOriginalFunction(canvas, "_onDrop", event);
            // Try to extract the data
            let data;
            try {
                data = JSON.parse(event.dataTransfer.getData('text/plain'));
            } catch (err) {
                return ret;
            }
            if (data.type === "Folder" && data.entity === "Actor")
                FurnaceTokenQoL._onDropActorFolder(event, data)
            return ret;
        });
    }

    static isGridFree(x, width, y, height) {
        for (let token of canvas.tokens.placeables) {
            if ((token.x < x + width && token.x + token.w > x) ||
                (token.y < y + height && token.y + token.h > y))
                return false;
        }
        return true;
    }

    static async _onDropActorFolder(event, data) {
        const folder = game.folders.get(data.id);
        const actors = folder.content;
        if (actors.length === 0) return;

        const content = await renderTemplate("modules/furnace/templates/token-folder-drop.html", {folder, actors});

        new Dialog({
            title: "Drop Actor Folder to Canvas",
            content: content,
            buttons: {
                yes: {
                    icon: '<i class="fas fa-level-down-alt"></i>',
                    label: `Drop ${actors.length} tokens`,
                    callback: async (html) => {
                        const choice = html.find("input[name='arrangement']:checked").val()
                        const hidden = event.altKey;
                        // Acquire cursor position transformed to Canvas coordinates
                        const t = canvas.tokens.worldTransform,
                            tx = (event.clientX - t.tx) / canvas.stage.scale.x,
                            ty = (event.clientY - t.ty) / canvas.stage.scale.y;
                        const topLeft = canvas.grid.getTopLeft(tx, ty);
                        let position = {x: topLeft[0], y: topLeft[1]}
                        if (choice === "same") {
                            for (let actor of actors) {
                                await this.dropActor(actor, {x: position.x, y: position.y, hidden});
                            }
                        } else if (choice === "random") {
                            let distance = 0;
                            let dropped = 0;
                            let offsetX = 0;
                            let offsetY = 0;
                            for (let actor of actors) {
                                const w = getProperty(actor, "data.token.width") || 1;
                                const h = getProperty(actor, "data.token.height") || 1;
                                const total_tries = Math.pow(1 + distance*2, 2) - Math.pow(distance*2 - 1, 2);
                                let tries = Math.pow(1 + distance*2, 2) - dropped;
                                while (tries > 0) {
                                    console.log(distance, dropped, tries, total_tries, offsetX, offsetY);
                                    if (true || FurnaceTokenQoL.isGridFree(position.x + offsetX, w, position.y + offsetY, h))
                                        await this.dropActor(actor, {x: position.x + offsetX, y: position.y + offsetY, hidden});
                                    if (total_tries - tries < total_tries / 4)
                                        offsetX += canvas.grid.w;
                                    else if (total_tries - tries < 2 * total_tries / 4)
                                        offsetY += canvas.grid.h;
                                    else if (total_tries - tries < 3 * total_tries / 4)
                                        offsetX -= canvas.grid.w;
                                    else
                                        offsetY -= canvas.grid.h;
                                    tries -= 1;
                                    break;
                                }
                                dropped += 1;
                                if (dropped === Math.pow(1 + distance*2, 2)) {
                                    distance += 1;
                                    offsetX = -1 * distance * canvas.grid.w;
                                    offsetY = -1 * distance * canvas.grid.h;
                                }
                            }
                        } else {
                            // Line up
                            const horizontal = (choice === "lr" || choice === "rl");
                            const direction = (choice === "lr" || choice === "tb") ? 1 : -1;
                            const step = horizontal ? canvas.grid.w : canvas.grid.h;
                            const total_grids = (horizontal ? canvas.grid.width : canvas.grid.height) / step;
                            const current_pos = (horizontal ? position.x : position.y) / step;
                            const grids_needed = actors.reduce((acc, actor) => {
                                return acc + getProperty(actor, horizontal ? "data.token.width" : "data.token.height") || 1
                            }, 0);
                            if (current_pos + grids_needed > total_grids)
                                return ui.notifications.error(`Not enough space in the scene to line up ${actors.length} tokens.`)
                            if (false && FurnaceTokenQoL.isGridFree(position.x, horizontal ? step * grids_needed * direction : canvas.grid.w, position.y, horizontal ? canvas.grid.h : step * grids_needed * direction))
                                return ui.notifications.error(`One or more tokens collides with an existing token in the scene.`)
                                
                            let offsetX = 0, offsetY = 0;
                            let previous_w = 0, previous_h = 0;
                            for (let actor of actors) {
                                const w = getProperty(actor, "data.token.width") || 1;
                                const h = getProperty(actor, "data.token.height") || 1;
                                // If going backwards, we need to offset our own size rather than the previous token's size
                                if (direction === -1) {
                                    offsetX = offsetX - previous_w + w * step * direction
                                    previous_w = w * step * direction;
                                    offsetY = offsetY - previous_h + h * step * direction
                                    previous_h = h * step * direction;
                                }
                                await this.dropActor(actor, {x: position.x + offsetX, y: position.y + offsetY, hidden});
                                if (horizontal)
                                    offsetX += w * step * direction;
                                else
                                    offsetY += h * step * direction;
                            }
                            
                        }
                    }
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel Drop"
                }
            },
            default: "yes"
        }, {width: 700}).render(true);

    }

    /* Copied from TokenLayer dropActor logic pre 0.7.0 */
    static async dropActor(actor, tokenData) {
        // Merge Token data with the default for the Actor
        tokenData = mergeObject(actor.data.token, tokenData, {inplace: false});
        // Get the Token image
        if ( tokenData.randomImg ) {
            let images = await actor.getTokenImages();
            images = images.filter(i => (images.length === 1) || !(i === canvas.tokens._lastWildcard));
            const image = images[Math.floor(Math.random() * images.length)];
            tokenData.img = canvas.tokens._lastWildcard = image;
        }

        // Submit the Token creation request and activate the Tokens layer (if not already active)
        return Token.create(tokenData);
    }
}

Hooks.on('init', FurnaceTokenQoL.init)
Hooks.on('getSceneControlButtons', FurnaceTokenQoL.getSceneControlButtons)
Hooks.on('setup', FurnaceTokenQoL.setup)