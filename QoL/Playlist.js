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
}

Hooks.on('init', FurnacePlaylistQoL.init)
Hooks.on('renderPlaylistDirectory', FurnacePlaylistQoL.renderDirectory)