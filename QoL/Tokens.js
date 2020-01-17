class FurnaceTokenQoL {
    static init() {
        game.settings.register("furnace", "tokenIgnoreVision", {
            name: "Ignore Token Vision for the GM",
            scope: "world",
            config: false,
            default: false,
            type: Boolean,
            onChange: value => {
                canvas.sight.updateLights();
                canvas.sight.updateSight({ updateFog: true });
                canvas.sight.restrictVisibility();
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
    static ready() {
        FurnacePatching.replaceMethod(Token, "_onMouseUp", async function (event) {
            const controlled = this.layer.controlled;
            if (controlled.length <= 1)
                return FurnacePatching.callOriginalFunction(this, "_onMouseUp", event);

            let { handleState, origin, destination, originalEvent, clones } = event.data;
            if ( handleState === 0 ) return;
            // Get Token movement data
            let offsetX = destination.x - origin.x,
                offsetY = destination.y - origin.y;


            // Determine updated token data for controlled tokens and update the Scene with all tokens
            let collision = false;
            let updateData = []
            for (let c of controlled) {
                let target = {
                    x: (c.x + offsetX),
                    y: (c.y + offsetY)
                };

                // Snap to grid unless shift is pressed
                if (!originalEvent.shiftKey) target = canvas.grid.getSnappedPosition(target.x, target.y, 1);

                // Check collision center-to-center
                let targetCenter = this.getCenter(target.x, target.y);
                let collide = this.checkCollision(targetCenter, { drag: true });
                collision = collision || collide;
                if (!collide) {
                    // Update token movement
                    updateData.push({_id: c.id, x: target.x, y: target.y})
                }
            }
            if (updateData.length > 0)
                await canvas.tokens.updateMany(updateData, {updateKeys: ["x", "y"]})
            if (collision)
                ui.notifications.warn("One or more tokens have hit a wall!");

            for (let clone of clones) {
                let c = controlled.find(t => t.id == clone.original_id)
                c.data.locked = false;
                c.alpha = 1.0;
            }
            this._onDragCancel(event);
        });

        FurnacePatching.replaceMethod(SightLayer, "updateSight", function (options) {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision")) {
                this.map.visible = false;
                this.fog.visible = false;
                this.restrictVisibility();
                return;
            }
            return FurnacePatching.callOriginalFunction(this, "updateSight", options);
        });
        FurnacePatching.replaceMethod(SightLayer, "updateLights", function (options) {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision")) {
                this.map.visible = false;
                this.fog.visible = false;
                return;
            }
            return FurnacePatching.callOriginalFunction(this, "updateLights", options);
        });
        FurnacePatching.replaceGetter(Token, "isVisible", function () {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision"))
                return true;
            return  FurnacePatching.callOriginalGetter(this, "isVisible");
        });
        FurnacePatching.replaceGetter(DoorControl, "isVisible", function () {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision"))
                return true;
            return  FurnacePatching.callOriginalGetter(this, "isVisible");
        });
    }
}

Hooks.on('init', FurnaceTokenQoL.init)
Hooks.on('getSceneControlButtons', FurnaceTokenQoL.getSceneControlButtons)
Hooks.on('ready', FurnaceTokenQoL.ready)