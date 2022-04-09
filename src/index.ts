import {
  ExtensionData,
  ExtensionFactory,
  ExtensionPreferenceGroup,
  MoosyncExtensionTemplate
} from '@moosync/moosync-types'
import { MyExtension } from './extension'
import semver from 'semver'

export default class MyExtensionData implements ExtensionData {
  extensionDescriptors: ExtensionFactory[] = [new MyExtensionFactory()]
}

class MyExtensionFactory implements ExtensionFactory {
  async registerPreferences(): Promise<ExtensionPreferenceGroup[]> {
    return [
      {
        type: 'EditText',
        key: 'plex_url',
        title: 'URL of plex server',
        description: 'http://localhost:32400',
        default: 'https://localhost:32400'
      },
      {
        type: 'EditText',
        key: 'plex_token',
        title: 'X-Plex-Token',
        description: 'https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/',
        default: ''
      }
    ]
  }

  async create(): Promise<MoosyncExtensionTemplate> {
    if (!semver.satisfies(process.env.MOOSYNC_VERSION, '>=1.3.0')) {
      logger.warn(
        'This extension was made for Moosync version 1.3.0 or above. Current version is',
        process.env.MOOSYNC_VERSION
      )
    }
    return new MyExtension()
  }
}
