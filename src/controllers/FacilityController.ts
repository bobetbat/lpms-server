import { NextFunction, Request, Response } from 'express';
import {
  FacilityIndexKey,
  FormattedDate,
  ModifiersKey,
  ModifiersValues,
  Rules,
  RulesItemKey
} from '../services/DBService';
import { DateTime } from 'luxon';
import ApiError from '../exceptions/ApiError';
import { SpaceAvailabilityRepository } from '../repositories/SpaceAvailabilityRepository';
import {
  FacilityModifierRepository,
  ItemModifierRepository
} from '../repositories/ModifierRepository';
import videreService from '../services/VidereService';
import facilityService from '../services/FacilityService';
import walletService from '../services/WalletService';
import facilityRepository from '../repositories/FacilityRepository';
import { Facility } from '../proto/facility';
import { validationResult } from 'express-validator';
import {
  FacilityRuleRepository,
  SpaceRuleRepository
} from '../repositories/RuleRepository';
import { getServiceProviderId } from '../utils';
import { walletAccountsIndexes } from '../types';
import stubService from '../services/StubService';

export class FacilityController {
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilities = await facilityService.getAllFacilities();

      return res.json(facilities);
    } catch (e) {
      next(e);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId } = req.params;
      const facility = await facilityRepository.getFacilityKey(
        facilityId,
        'metadata'
      );

      if (!facility) {
        throw ApiError.NotFound(`Unable to get facility: ${facilityId}`);
      }

      return res.json(facility);
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { salt } = req.params;
      const { metadata } = req.body;

      const facilityId = getServiceProviderId(
        salt,
        await walletService.getWalletAddressByIndex(walletAccountsIndexes.API)
      );

      await facilityService.saveFacilityMetadata(
        facilityId,
        metadata,
        undefined,
        undefined,
        salt
      );

      await facilityService.setFacilityDbKeys(facilityId, [
        ['metadata', metadata as Facility]
      ]);

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId } = req.params;
      const { metadata } = req.body;

      if (!(await facilityRepository.getFacilityKey(facilityId, 'metadata'))) {
        throw ApiError.BadRequest(`facility: ${facilityId} not exist`);
      }

      const spaces = await facilityService.getFacilityDbKeyValues(
        facilityId,
        'spaces'
      );

      const otherItems = await facilityService.getFacilityDbKeyValues(
        facilityId,
        'otherItems'
      );

      await facilityService.saveFacilityMetadata(
        facilityId,
        metadata,
        spaces,
        otherItems
      );

      await facilityService.setFacilityDbKeys(facilityId, [
        ['metadata', metadata as Facility]
      ]);

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId } = req.params;

      if (!(await facilityRepository.getFacilityKey(facilityId, 'metadata'))) {
        throw ApiError.BadRequest(`facility: ${facilityId} not exist`);
      }

      const stubs = await facilityService.getFacilityDbKeyValues(
        facilityId,
        'stubs'
      );

      if (stubs && stubs.length > 0) {
        // Deactivate and delist the facility
        await videreService.stopFacility(facilityId);
        await facilityRepository.delFacilityFromIndex(facilityId);
      } else {
        // Delete the facility and associated scope
        await videreService.stopFacility(facilityId);
        await facilityRepository.delAllFacilityKeys(facilityId);
        await facilityRepository.delFacilityFromIndex(facilityId);
      }

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Returns availability of the space
  getSpaceAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, spaceId, date } = req.params;

      const repository = new SpaceAvailabilityRepository(facilityId, spaceId);
      const availability = await repository.getSpaceAvailability(
        date as FormattedDate
      );

      if (!availability) {
        throw ApiError.NotFound(
          `Unable to get availability of space: ${spaceId} of the facility: ${facilityId}`
        );
      }

      return res.json(availability);
    } catch (e) {
      next(e);
    }
  };

  // Adds availability of the space by date
  createSpaceAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, spaceId, date } = req.params;
      const { numSpaces } = req.body;

      if (!DateTime.fromSQL(date).isValid) {
        throw ApiError.BadRequest('Invalid availability date format');
      }

      const repository = new SpaceAvailabilityRepository(facilityId, spaceId);
      await repository.setAvailabilityByDate(date as FormattedDate, {
        numSpaces: Number(numSpaces)
      });

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Adds/updates `default` availability of the space
  createDefaultSpaceAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, spaceId } = req.params;
      const { numSpaces } = req.body;

      const repository = new SpaceAvailabilityRepository(facilityId, spaceId);
      await repository.setAvailabilityDefault({ numSpaces: Number(numSpaces) });

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Returns modifier of facility
  getModifierOfFacility = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, modifierKey } = req.params;

      const repository = new FacilityModifierRepository(facilityId);
      const modifier = await repository.getModifier(
        modifierKey as ModifiersKey
      );

      if (!modifier) {
        throw ApiError.NotFound(
          `Unable to get "${modifierKey}" of the facility: ${facilityId}`
        );
      }

      res.json(modifier);
    } catch (e) {
      next(e);
    }
  };

  // Returns modifier of the item: `spaces` or `otherItems`
  getModifierOfItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemKey, itemId, modifierKey } = req.params;

      const repository = new ItemModifierRepository(
        facilityId,
        itemKey as FacilityIndexKey,
        itemId
      );

      let modifier = await repository.getModifier(modifierKey as ModifiersKey);

      if (!modifier) {
        // If item does not contain such modifier then try to lookup the facility
        const facilityRepository = new FacilityModifierRepository(facilityId);
        modifier = await facilityRepository.getModifier(
          modifierKey as ModifiersKey
        );
      }

      if (!modifier) {
        throw ApiError.NotFound(
          `Unable to get "${modifierKey}" of the "${itemKey}": ${itemId} of the facility: ${facilityId}`
        );
      }

      res.json(modifier);
    } catch (e) {
      next(e);
    }
  };

  // Creates a modifier for the facility
  createFacilityModifier = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, modifierKey } = req.params;
      const modifier = req.body;

      const repository = new FacilityModifierRepository(facilityId);
      await repository.setModifier(
        modifierKey as ModifiersKey,
        modifier as ModifiersValues
      );

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Creates a modifier for the item: spaces or otherItems
  createItemModifier = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemKey, itemId, modifierKey } = req.params;
      const modifier = req.body;

      const repository = new ItemModifierRepository(
        facilityId,
        itemKey as FacilityIndexKey,
        itemId
      );

      await repository.setModifier(
        modifierKey as ModifiersKey,
        modifier as ModifiersValues
      );

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Removes a modifier from the facility
  removeModifierOfFacility = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, modifierKey } = req.params;

      const repository = new FacilityModifierRepository(facilityId);
      await repository.delModifier(modifierKey as ModifiersKey);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Removes modifier of the item: `spaces` or `otherItems`
  removeModifierOfItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemKey, itemId, modifierKey } = req.params;

      const repository = new ItemModifierRepository(
        facilityId,
        itemKey as FacilityIndexKey,
        itemId
      );

      await repository.delModifier(modifierKey as ModifiersKey);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Returns rules of facility
  getRuleOfFacility = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, ruleKey } = req.params;

      const repository = new FacilityRuleRepository(facilityId);
      const rule = await repository.getRule(ruleKey as RulesItemKey);

      if (!rule) {
        throw ApiError.NotFound(
          `Unable to get "${ruleKey}" of the facility: ${facilityId}`
        );
      }

      res.json(rule);
    } catch (e) {
      next(e);
    }
  };

  // Returns rule of the item: `spaces` or `otherItems`
  getRuleOfItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemId, ruleKey } = req.params;

      const repository = new SpaceRuleRepository(facilityId, itemId);

      const rule = await repository.getRule(ruleKey as RulesItemKey);

      if (!rule) {
        throw ApiError.NotFound(
          `Unable to get "${ruleKey}": ${itemId} of the facility: ${facilityId}`
        );
      }

      res.json(rule);
    } catch (e) {
      next(e);
    }
  };

  // Creates a rule for the facility
  createFacilityRule = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, ruleKey } = req.params;
      const rule = req.body;

      const repository = new FacilityRuleRepository(facilityId);

      await repository.setRule(ruleKey as RulesItemKey, rule as Rules);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Creates a rule for the item: spaces or otherItems
  createItemRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemId, ruleKey } = req.params;
      const rule = req.body;

      const repository = new SpaceRuleRepository(facilityId, itemId);

      await repository.setRule(ruleKey as RulesItemKey, rule as Rules);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Removes a rule from the facility
  delRuleOfFacility = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, ruleKey } = req.params;

      const repository = new FacilityRuleRepository(facilityId);
      await repository.delRule(ruleKey as RulesItemKey);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // Removes rule of the item: `spaces` or `otherItems`
  delRuleOfItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemId, ruleKey } = req.params;

      const repository = new SpaceRuleRepository(facilityId, itemId);

      await repository.delRule(ruleKey as RulesItemKey);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // activate facility services for facility by id
  activateServices = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId } = req.params;

      await videreService.startFacility(facilityId);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  // deactivate facility services for facility by id
  deactivateServices = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId } = req.params;

      await videreService.stopFacility(facilityId);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  async getAllFacilityStubs(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId } = req.params;

      const index = req.query.index || 0;
      const perPage = req.query.perPage || 10;

      const result = await stubService.getFacilityStubs(
        facilityId,
        index as number,
        perPage as number
      );

      return res.json(result);
    } catch (e) {
      next(e);
    }
  }

  async getFacilityStubsByDate(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, date } = req.params;

      const stubs = await stubService.getFacilityStubsByDate(
        facilityId,
        date as FormattedDate
      );

      return res.json(stubs);
    } catch (e) {
      next(e);
    }
  }
}

export default new FacilityController();
