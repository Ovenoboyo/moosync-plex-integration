declare const logger: {
  log: Function
  error: Function
  info: Function
  warn: Function
  trace: Function
  debug: Function
}

interface DirectoryGroup {
  type: string
  directory: boolean
  key: string
}

interface PlexLibraries {
  MediaContainer?: {
    Directory?: DirectoryGroup[]
  }
}

interface ArtistMetadata {
  key: string
  type: string
}

interface AllArtists {
  MediaContainer: {
    Metadata: ArtistMetadata[]
  }
}

interface PlaylistMetadata {
  key: string
  type: 'playlist'
  title: string
  guid: string
  composite: string
}

type MoosyncPlaylist = import('@moosync/moosync-types').Playlist
interface ExtendedMoosyncPlaylist extends MoosyncPlaylist {
  plexKey: string
}

interface AllPlaylists {
  MediaContainer: {
    Metadata: PlaylistMetadata[]
  }
}

interface TrackMetadata {
  type: string
  title: string
  guid: string
  parentTitle: string
  grandparentTitle: string
  parentYear: number
  thumb: string
  parentThumb: string
  grandparentThumb: string
  addedAt: number
  duration: number
  Media: {
    audioCodec: string
    container: string
    Part: {
      duration: number
      size: number
      key: string
    }[]
  }[]
}

interface AllTracks {
  MediaContainer?: {
    Metadata: TrackMetadata[]
  }
}
