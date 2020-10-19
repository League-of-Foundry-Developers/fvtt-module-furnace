class FurnacePlaylistQoL {

  static init() {
    game.settings.register("furnace", "playlistQoL", {
      name: "Improve the Playlists UI",
      hint: "Hides sound controls until hovered and shows what's playing at the top. Disable if it conflicts with other modules.",
      scope: "world",
      config: true,
      default: true,
      type: Boolean,
      onChange: value => ui.playlists.render()
    });
    game.settings.register("furnace", "volumeDbExponent", {
      name: game.i18n.localize("FURNACE.PLAYLIST.volumeDbExponent"),
      hint: game.i18n.localize("FURNACE.PLAYLIST.volumeDbExponentHint"),
      scope: "world",
      config: true,
      default: 3,
      type: Number,
      onChange: value => ui.playlists.render()
    });

    // Replace volume/input controls to use x^3 equation for volume conversion
    FurnacePatching.replaceFunction(AudioHelper, "volumeToInput", function (volume, order) {
      return FurnacePatching.callOriginalFunction(this, "volumeToInput", volume, order || game.settings.get("furnace", "volumeDbExponent"))
  });
  FurnacePatching.replaceFunction(AudioHelper, "inputToVolume", function (volume, order) {
      return FurnacePatching.callOriginalFunction(this, "inputToVolume", volume, order || game.settings.get("furnace", "volumeDbExponent"))
  });
  }

  static async renderDirectory(obj, html, data) {
    if (game.settings.get("furnace", "playlistQoL") === false)
      return;
    html.find(".sound-control[data-action=sound-stop]").parents(".sound").addClass("sound-is-playing")
    const isPlaying = data.entities.map(playlist => playlist.sounds.find(sound => sound.playing)).some(sound => !!sound);
    if (isPlaying) {
      // On 0.4.4, the sound id is in sound._id instead of sound.id
      data.use_id = isNewerVersion(game.data.version, "0.4.3")
      const nowPlaying = await renderTemplate("modules/furnace/templates/playlist-now-playing.html", data)
      html.find(".directory-item.playlist").eq(0).after(nowPlaying)
    }
    let sounds = html.find("li.sound");
    for (let sound of sounds) {
      sound = $(sound)
      sound.find(".sound-name, .sound-controls").addClass("furnace-qol")
      sound.find(`.sound-control[data-action=sound-edit],
                  .sound-control[data-action=sound-delete],
                  .sound-volume`).addClass("furnace-hide-control sound-control-hidden")
      sound.hover(e => $(e.currentTarget).find(".furnace-hide-control").toggleClass("sound-control-hidden"))
      
      sound.find('.sound-volume').change(event => obj._onSoundVolume(event));
    }
  }

  /**
   * Helper function to find and toggle play state of a sound in a playlist.
   * You can specify the full playlist/sound name or just the start of the name.
   * Only the first playlist/sound that is found will be played in case it matches multiple ones.
   * 
   * @param {String} playlistName   Playlist name
   * @param {String} soundName      Sound name
   * @param {Boolean} startsWith    (Optional) whether to match the whole name or just the beginning
   */
  static PlaySound(playlistName, soundName, startsWith=false) {
    const playlist = game.playlists.entities.find(p => startsWith ? p.name.startsWith(playlistName) : p.name === playlistName);
    if (!playlist)
      return;
    const sound = playlist.sounds.find(s => startsWith ? s.name.startsWith(soundName) : s.name === soundName);
    
    if (sound)
      playlist.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, playing: !sound.playing})
  }
}

Hooks.on('init', FurnacePlaylistQoL.init)
Hooks.on('renderPlaylistDirectory', FurnacePlaylistQoL.renderDirectory)