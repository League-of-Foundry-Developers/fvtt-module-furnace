
class FurnacePatching {

    static patchClass(klass, func, line_number, line, new_line) {
        // Check in case the class/function had been deprecated/removed
        if (func === undefined)
            return;
        let funcStr = func.toString()
        // Check for newlines so it can work on minified content too
        const splitChar = funcStr.indexOf("\n") >= 0 ? "\n" : ";";
        let lines = funcStr.split(splitChar)
        if (lines[line_number].trim() == line.trim()) {
            lines[line_number] = lines[line_number].replace(line, new_line);
            let fixed = lines.join(splitChar)
            if (klass !== undefined) {
                let classStr = klass.toString()
                fixed = classStr.replace(funcStr, fixed)
            } else {
                // Check if it's a method instead of a function, add 'function' as we define it, but don't do it for 'async function'
                if (!fixed.startsWith("function") && !fixed.match(/^async\s+function/))
                    fixed = "function " + fixed
                if (fixed.startsWith("function async"))
                    fixed = fixed.replace("function async", "async function");
            }
            return Function('"use strict";return (' + fixed + ')')();
        } else {
            console.log("Cannot patch function. It has wrong content at line ", line_number, " : ", lines[line_number].trim(), " != ", line.trim(), "\n", funcStr)
        }
    }

    static patchFunction(func, line_number, line, new_line) {
        return FurnacePatching.patchClass(undefined, func, line_number, line, new_line)
    }
    static patchMethod(klass, func, line_number, line, new_line) {
        return FurnacePatching.patchClass(klass, klass.prototype[func], line_number, line, new_line)
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
    }
}
FurnacePatching.ORIG_PRREFIX = "__furnace_original_"

Hooks.on('init', FurnacePatching.init)