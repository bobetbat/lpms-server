import { AbstractSublevel } from 'abstract-level';
import DBService, {
  DBLevel,
  LevelDefaultTyping,
  FacilityItemValues,
  FacilityValues,
  FacilityIndexKey,
  ModifiersKey,
  ModifiersValues
} from '../services/DBService';

abstract class ModifierRepository {
  protected dbService: DBService = DBService.getInstance();
  protected db;

  public async getModifier<T extends ModifiersValues>(
    key: ModifiersKey
  ): Promise<T | null> {
    try {
      return (await this.db.get(key)) as T;
    } catch (e) {
      if (e.status !== 404) {
        throw e;
      }
    }
    return null;
  }

  public async setModifier(
    key: ModifiersKey,
    value: ModifiersValues
  ): Promise<void> {
    await this.db.put(key, value);
  }

  public async delModifier(key: ModifiersKey): Promise<void> {
    await this.db.del(key);
  }
}

export class ItemModifierRepository extends ModifierRepository {
  protected db: AbstractSublevel<
    AbstractSublevel<
      AbstractSublevel<DBLevel, LevelDefaultTyping, string, FacilityValues>,
      LevelDefaultTyping,
      string,
      FacilityItemValues
    >,
    LevelDefaultTyping,
    ModifiersKey,
    ModifiersValues
  >;

  constructor(facilityId: string, indexKey: FacilityIndexKey, itemId: string) {
    super();

    this.db = this.dbService.getItemModifiersDB(facilityId, indexKey, itemId);
  }
}

export class FacilityModifierRepository extends ModifierRepository {
  protected db: AbstractSublevel<
    AbstractSublevel<DBLevel, LevelDefaultTyping, string, FacilityValues>,
    LevelDefaultTyping,
    ModifiersKey,
    ModifiersValues
  >;

  constructor(facilityId: string) {
    super();

    this.db = this.dbService.getFacilityModifiersDB(facilityId);
  }
}

export class SpaceModifierRepository extends ItemModifierRepository {
  constructor(facilityId: string, spaceId: string) {
    super(facilityId, 'spaces', spaceId);
  }
}

export class OtherItemsModifierRepository extends ItemModifierRepository {
  constructor(facilityId: string, otherItemId: string) {
    super(facilityId, 'otherItems', otherItemId);
  }
}
