
class FurnacePatching {

    static patchClass(klass, func, line_number, line, new_line) {
        let funcStr = func.toString()
        let lines = funcStr.split("\n")
        if (lines[line_number].trim() == line.trim()) {
            lines[line_number] = lines[line_number].replace(line, new_line);
            classStr = klass.toString()
            fixedClass = classStr.replace(funcStr, lines.join("\n"))
            return Function('"use strict";return (' + fixedClass + ')')();
        } else {
            console.log("Cannot patch function. It has wrong content at line ", line_number, " : ", lines[line_number].trim(), " != ", line.trim(), "\n", funcStr)
        }
    }
  
}