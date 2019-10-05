
class FurnacePatching {

    static patchClass(klass, func, line_number, line, new_line) {
        let funcStr = func.toString()
        let lines = funcStr.split("\n")
        if (lines[line_number].trim() == line.trim()) {
            lines[line_number] = lines[line_number].replace(line, new_line);
            let fixed = lines.join("\n")
            if (klass !== undefined) {
                let classStr = klass.toString()
                fixed = classStr.replace(funcStr, fixed)
            }
            return Function('"use strict";return (' + fixed + ')')();
        } else {
            console.log("Cannot patch function. It has wrong content at line ", line_number, " : ", lines[line_number].trim(), " != ", line.trim(), "\n", funcStr)
        }
    }

    static patchFunction(func, line_number, line, new_line) {
        return FurnacePatching.patchClass(undefined, func, line_number, line, new_line)
    }

    static replaceFunction(klass, name, func) {
        klass[this.ORIG_PRREFIX + name] = klass[name]
        klass[name] = func
    }
    static replaceMethod(klass, name, func) {
        return this.replaceFunction(klass.prototype, name, func)
    }
    static replaceStaticGetter(klass, name, func) {
        let getterProperty = Object.getOwnPropertyDescriptor(klass, name);
        if (getterProperty == undefined)
            return false;
        Object.defineProperty(klass, FurnacePatching.ORIG_PRREFIX + name, getterProperty);
        Object.defineProperty(klass, name, { get: func });
        return true;
    }
    static replaceGetter(klass, name, func) {
        return this.replaceStaticGetter(klass.prototype, name, func)
    };

    // Would be the same code for callOriginalMethod as long as 'klass' is actually the instance
    static callOriginalFunction(klass, name, ...args) {
        return klass[this.ORIG_PRREFIX + name].call(klass, ...args)
    }
    static callOriginalGetter(klass, name) {
        return klass[this.ORIG_PRREFIX + name]
    }

    static init() {
        FurnacePatching.replaceFunction(PlaceablesLayer, "_deletePlaceableObject",
            function ({ parentId, deleted }) {
                delete this.instance._controlled[deleted]
                return FurnacePatching.callOriginalFunction(this, "_deletePlaceableObject", ...arguments)
            });
        FurnacePatching.replaceMethod(PlaceablesLayer, "draw",
            function () {
                this._controlled = {}
                return FurnacePatching.callOriginalFunction(this, "draw", ...arguments)
            });
        FurnacePatching.replaceMethod(Token, "_onUpdateTokenActor", function (updateData) {
            if (this.actor != null)
                return FurnacePatching.callOriginalFunction(this, "_onUpdateTokenActor", updateData);
        });
    }
}
FurnacePatching.ORIG_PRREFIX = "__furnace_original_"

Hooks.on('init', FurnacePatching.init)