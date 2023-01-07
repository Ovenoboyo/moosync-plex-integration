import { MoosyncExtensionTemplate, Playlist, Song } from '@moosync/moosync-types'
import axios from 'axios'
import adapter from 'axios/lib/adapters/http'
import semver from 'semver'
export class MyExtension implements MoosyncExtensionTemplate {
  private axios = axios.create({ adapter })
  private baseURL = ''
  private token = ''

  private scanInProgress = false
  private scanQueued = false

  async onStarted() {
    this.baseURL = await api.getPreferences<string>('plex_url', '')
    if (this.baseURL.endsWith('/')) {
      this.baseURL = this.baseURL.substring(0, -1)
    }

    this.token = await api.getPreferences<string>('plex_token', '')
    logger.info('Plex extension started')
    if (semver.satisfies(process.env.MOOSYNC_VERSION, '>=1.3.0')) {
      this.registerListeners()
      await this.scanPlex()
    }
  }

  private async scanPlex() {
    if (this.scanInProgress) {
      this.scanQueued = true
      return
    }

    this.scanInProgress = true
    try {
      for (const l of await this.getLibraries()) {
        const artists = await this.getAllArtists(l.key)
        for (const a of artists) {
          const albums = await this.getArtistAlbums(a)
          for (const al of albums) {
            const songs = await this.getAlbumSongs(al)
            for (const s of songs.MediaContainer.Metadata) {
              const parsed = this.parseSong(s)
              if (parsed) {
                const existing = await api.getSongs({
                  song: { _id: parsed._id }
                })
                if (existing.length === 0) {
                  await api.addSongs(parsed)
                }
              }
            }
          }
        }
      }
    } catch (e) {
      logger.error(e)
    }
    this.scanInProgress = false

    if (this.scanQueued) {
      this.scanQueued = false
      return this.scanPlex()
    }
  }

  private async getLibraries() {
    const resp = await this.axios.get<PlexLibraries>(`${this.baseURL}/library/sections?X-Plex-Token=${this.token}`)
    const musicLibraries: DirectoryGroup[] = []
    if (resp.data.MediaContainer?.Directory?.length ?? 0 > 0) {
      for (const d of resp.data.MediaContainer?.Directory) {
        if (d.type === 'artist') {
          musicLibraries.push(d)
        }
      }
    }
    return musicLibraries
  }

  private async getAllArtists(key: string) {
    const resp = await this.axios.get<AllArtists>(
      `${this.baseURL}/library/sections/${key}/all?X-Plex-Token=${this.token}`
    )
    const artists: string[] = []
    if (resp.data.MediaContainer?.Metadata?.length ?? 0 > 0) {
      for (const a of resp.data.MediaContainer.Metadata) {
        if (a.type === 'artist') artists.push(a.key)
      }
    }

    return artists
  }

  private async getArtistAlbums(key: string) {
    const resp = await this.axios.get<AllArtists>(this.resolveURL(key))
    const albums: string[] = []
    if (resp.data.MediaContainer?.Metadata?.length ?? 0 > 0) {
      for (const a of resp.data.MediaContainer.Metadata) {
        if (a.type === 'album') albums.push(a.key)
      }
    }

    return albums
  }

  private async getPlaylists() {
    const resp = await this.axios.get<AllPlaylists>(`${this.baseURL}/playlists?X-Plex-Token=${this.token}`)

    const playlists: ExtendedMoosyncPlaylist[] = []
    for (const p of resp.data.MediaContainer.Metadata) {
      if (p.type === 'playlist') {
        playlists.push({
          playlist_id: p.key,
          playlist_name: p.title,
          playlist_coverPath: `${this.baseURL}${p.composite}?X-Plex-Token=${this.token}`,
          plexKey: p.key
        })
      }
    }
    return playlists
  }

  private async getPlaylistContent(playlistId: string) {
    const parsedKey = Buffer.from(playlistId, 'base64').toString('utf-8')
    const resp = await this.axios.get<AllTracks>(`${this.baseURL}${parsedKey}?X-Plex-Token=${this.token}`)

    const songs: Song[] = []
    for (const s of resp.data.MediaContainer.Metadata) {
      if (s.type === 'track') {
        songs.push(this.parseSong(s))
      }
    }

    return songs
  }

  private async getAlbumSongs(key: string) {
    const resp = await this.axios.get<AllTracks>(this.resolveURL(key))
    return resp.data
  }

  private resolveURL(path: string) {
    return `${this.baseURL}${path}?X-Plex-Token=${this.token}`
  }

  private parseSong(track: TrackMetadata): Song | undefined {
    if (track.Media.length > 0 && track.Media[0].Part.length > 0) {
      return {
        _id: track.guid.replace('plex://track/', ''),
        title: track.title,
        date_added: track.addedAt * 1000,
        duration: track.duration / 1000,
        artists: [{ artist_id: `emby-artist:${track.grandparentTitle}`, artist_name: track.grandparentTitle }],
        album: {
          album_name: track.parentTitle,
          album_coverPath_high: this.resolveURL(track.parentThumb),
          album_coverPath_low: this.resolveURL(track.parentThumb)
        },
        playbackUrl: this.resolveURL(track.Media[0].Part[0].key),
        type: 'URL',
        codec: track.Media[0].audioCodec,
        container: track.Media[0].container
      }
    }
    return undefined
  }

  private registerListeners() {
    api.on('requestedPlaylists', async () => {
      const playlists = await this.getPlaylists()
      return {
        playlists
      }
    })

    api.on('requestedPlaylistSongs', async (playlist_id) => {
      const songs = await this.getPlaylistContent(playlist_id)

      return {
        songs
      }
    })

    api.on('preferenceChanged', this.onPreferenceChanged.bind(this))
  }

  private async onPreferenceChanged({ key, value }: { key: string; value: any }): Promise<void> {
    if (key === 'plex_url') {
      this.baseURL = value
      if (this.baseURL.endsWith('/')) {
        this.baseURL = this.baseURL.substring(0, -1)
      }
    }

    if (key === 'plex_token') {
      this.token = value
    }

    if (semver.satisfies(process.env.MOOSYNC_VERSION, '>=1.3.0')) {
      const existingSongs = await api.getSongs({ song: { extension: true } })
      for (const s of existingSongs) {
        await api.removeSong(s._id)
      }

      await this.scanPlex()
    }
  }
}
