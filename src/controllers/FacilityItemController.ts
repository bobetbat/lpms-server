import type { NextFunction, Request, Response } from 'express';
import ApiError from '../exceptions/ApiError';
import facilityService from '../services/FacilityService';
import facilityRepository from '../repositories/FacilityRepository';
import { Space } from '../proto/facility';
import { validationResult } from 'express-validator';
import { FacilityIndexKey } from '../services/DBService';
import stubService from '../services/StubService';

export class FacilityItemController {
  getAllItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId, itemKey } = req.params;
      const items = await facilityService.getFacilityDbKeyValues(
        facilityId,
        itemKey as FacilityIndexKey
      );

      return res.json(items);
    } catch (e) {
      next(e);
    }
  };

  getOneItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemKey, itemId } = req.params;
      const item = await facilityRepository.getItemKey<Space>(
        facilityId,
        itemKey as FacilityIndexKey,
        itemId,
        'metadata'
      );

      if (!item) {
        throw ApiError.NotFound(`Unable to get facility: ${facilityId}`);
      }

      return res.json(item);
    } catch (e) {
      next(e);
    }
  };

  createItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemKey, itemId } = req.params;
      const { metadata } = req.body;

      if (
        await facilityRepository.getItemKey<Space>(
          facilityId,
          itemKey as FacilityIndexKey,
          itemId,
          'metadata'
        )
      ) {
        throw ApiError.BadRequest(
          `item: ${itemId} in facility: ${facilityId} already exist`
        );
      }

      await facilityService.setItemDbKeys(
        facilityId,
        itemKey as FacilityIndexKey,
        itemId,
        [['metadata', metadata]]
      );

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }

      const { facilityId, itemKey, itemId } = req.params;
      const { metadata } = req.body;

      if (
        !(await facilityRepository.getItemKey<Space>(
          facilityId,
          itemKey as FacilityIndexKey,
          itemId,
          'metadata'
        ))
      ) {
        throw ApiError.BadRequest(
          `item: ${itemId} in facility: ${facilityId} not exist`
        );
      }

      await facilityService.setItemDbKeys(
        facilityId,
        itemKey as FacilityIndexKey,
        itemId,
        [['metadata', metadata]]
      );

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  delItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }

      const { facilityId, itemKey, itemId } = req.params;

      if (
        !(await facilityRepository.getItemKey<Space>(
          facilityId,
          itemKey as FacilityIndexKey,
          itemId,
          'metadata'
        ))
      ) {
        throw ApiError.BadRequest(
          `item: ${itemId} in facility: ${facilityId} not exist`
        );
      }

      await facilityService.delItemMetadata(
        facilityId,
        itemKey as FacilityIndexKey,
        itemId
      );

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  };

  async getStubsByDate(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Validation error', errors.array()));
      }
      const { facilityId, itemId } = req.params;
      const { date } = req.body;

      const stubs = await stubService.getSpaceStubsByDate(
        facilityId,
        itemId,
        date
      );

      return res.json(stubs);
    } catch (e) {
      next(e);
    }
  }
}

export default new FacilityItemController();
