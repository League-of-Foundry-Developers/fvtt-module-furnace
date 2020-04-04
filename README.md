# The Furnace

The Furnace is an essential part of every Foundry.

This Foundry VTT module brings Quality of Life Improvements to the VTT.  
It started by adding Drawing Tools functionality to FVTT and then an experimental Macro system. It has now evolved into many small QoL Improvement features, some of which were later integrated into the core Foundry software.

The current features are : 
- **Advanced Drawing Tools :** Improved drawing tools with different pattern fill types, new HUD, and various options.
- **Advanced Macros:** Use async script macros, handlebars templating, recursive macro calls and call macros with arguments or directly from chat.
- **Split Journal :** Select the split option from the context menu on a journal entry to split it into multiple entries.
- **Tokens :** As GM, you can enable/disable token vision for yourself. You can also drop an actor folder into a scene to deploy multiple tokens at once.
- **Combat :** Double click the initiative value in the combat tracker to quickly modify it.
- **Playlists :** Adds a 'Now Playing' section, and auto-hides sound controls until hovered. Helps in fine tuning of low level volumes

More QoL improvements are planned.

# Installation

You can now install this module automatically by specifying the following public module URL : `https://raw.githubusercontent.com/kakaroto/fvtt-module-furnace/master/module.json`

As GM go to the `Manage Modules` options menu in your World Settings tab then enable the `The Furnace` module.

# How to use

This module aggregates many small improvements, some are self explanatory, but some do require some instructions. Here are quick howtos for the more advanced features of The Furnace.

Let's start with the easy start and progressively go to the more complicated features.

## Combat, Playlist, Tokens, Other

- You can double click the combat tracker's initiative area to edit its value quickly.

- The playlist will feature a "Now Playing" section to make it easier to find and manage your currently playing music.

- A "Toggle Vision" button in the token's scene controls is added to the GM controls which allows the GM to disable vision when selecting tokens.

- Party line-up allows you to drag&drop an entire folder of tokens into the map and have the tokens lining up any way you like. The party line up follows the order that the actors are sorted in within the folder.

- Handlebar helpers are available to use by templates. Use `Handlebars.helpers` to see the available helpers.

- A function `FurnacePlaylistQoL.PlaySound` is available for macros to use. It takes two mandatory arguments, the first being the name of a playlist, the second the name of the sound.

- A "Debug" setting allows you to see in the developer's console all API hooks that Foundry VTT uses. Useful for debugging and for module developers.

- A set of function/method replacement and monkey patching utility functions are available for use. Refer to the `Patches/Patches.js` file for details on the API available.

## Split Journal

If you have a journal entry with a lot of room descriptions and you want to split it into smaller journal entries, you can right click on it and select the "Split Journal" option. It will let you choose which heading to split it at then do the split for you.

If you cannot split a journal or it doesn't suggest the right sections for you to split at, make sure you set your delimiters as one of the available headings in the journal entry's rich text editor.


## Advanced Drawing Tools

The Drawing Tools in Furnace predate the implementation in Core, and it has been quite difficult to adapt the extensive work I did to work around the implementation in FVTT, so The Furnace simply replaces the drawing tools of Foundry with its own implementation. Therefore, it doesn't simply 'add features', but is a different implementation altogether.

Since this is a big change to the core software, the advanced drawing tools **must be enabled in the Furnace settings**.

The biggest difference is probably the various options available for how to apply textures to drawings. You can set a texture to be stretched, tiled, stretched on the contour only or tiled on the contour, and you can set the tiling size of a texture as well.

You will also find a new 'Text' tool which can be used to draw text which can be scaled to whatever size you want, instead of being a label of fixed size on an existing drawing.

The Drawing tools from Furnace are also more stable (as far as I'm aware) than the core implementation. This allows you to have textures of any size, the freehand drawings will be smoother, and there's a handle for rotation drawings. It is not without bugs however and some things are still unfortunately clunky to use.

## Advanced Macros

With Advanced Macros, a "Run Macro" button will appear in macro configuration windows to allow you to quickly test your macro and see its results. Do note that if you use an asynchronous macro which never resolves, you may end up with a macro in an invalid state if you end up cancelling the changes.

**When advanced macros are enabled**, this option grants you additional power over the type of macros you can create.

In the case of chat macros, you can now use [handlebars](https://handlebarsjs.com/) templating to render your chat text using common helpers, or use it along with the `macro` helper to call other macros, like for example `{{macro "name of my macro" actor 3 "a text argument"}}` 

In the case of script macros, you can now use a `return` statement for the early return paradigm, but also to retun a string which can then be used in chat macros. You will also be able to receive arguments via an array named `args`, and you can use the `await` keyword to make your script asynchronous. Do note however that if you create an async macro, it cannot be used to return text in a chat macro when using the `{{macro}}` helper. It will still be executed if used, but will be considered to have returned an empty string. If you want to use an async macro that prints its results to chat, read further for the use of recursive async chat commands.

Besides those two enhancements to macros, you can now also create a temporary chat macro with handlebars templating directly from the chat entry, by entering text in the chat that includes the handlebars mustache characters `{{ }}`. You will also be able to call your macro directly from chat with the `/` prefix. As an example, you can send in the chat `/my-macro-name argument1 argument2 argument3`.
If your macro name has spaces in it, you can call it with `/"My macro name" "argument one" 100` for example. You can also call multiple macros by writing them one per line.

In addition, you can now recursively call macros, so you could call a script or chat macro which returns a `/macro-name` text for it to call the macros recursively.

Here is an example of use :
- **Macro name**: `Move token`
- **Type**: script
- **Content**: 
```js
if (!token) return;
await token.update({x: args[0], y: args[1]})
return `Token moved to (${args[0]}, ${args[1]})`
```

- **Macro name**: `pan`
- **Type**: script
- **Content**:
```js
canvas.pan({x: args[0], y: args[1], scale: args[2]})
```

- **Macro name**: `current-time`
- **Type**: script
- **Content**:
```js
const now = new Date();
return `${now.getHours()}:${now.getMinutes()}`;
```

- **Macro name**: `Return to corner`
- **Type**: chat
- **Content**:
```
/"Move token" 0 0
/pan 1000 1000 0.5
It's currently {{macro "current-time"}}
```

- **Macro name**: `run`
- **Type**: chat
- **Content**:
```
/"Return to corner"
```

You can then type `/run` in the chat to execute the 'run' macro which executes 'Return to corner' which will move the token to position (0, 0), then pan the canvas to position (1000, 1000) with a zoom of 50%, then output to the chat `Token moved to (0,0)\n\nIt's currently 21:45`

**Note**: HTML content will not be parsed for /command macros, though you will still be able to use the `{{macro}}` helper in that case. 
**Note 2**: You can only use one space to separate each argument. If you use more than one space, FVTT will replace the second with `&nbsp;` as it transforms the chat input into html, which would break your argument list.

# Support

If you like this module and would like to help support its development, you can subscribe to my [Patreon](https://www.patreon.com/kakaroto) or if you prefer, you can also send me some rations via [Ko-Fi](https://ko-fi.com/kakaroto)

# License
This Foundry VTT module, writen by KaKaRoTo, is licensed under a [Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/).

This work is licensed under Foundry Virtual Tabletop [EULA - Limited License Agreement for module development v 0.1.6](http://foundryvtt.com/pages/license.html).