import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import { requireFarmAccess } from '../middleware/rbac.middleware';
import { PigController } from '../controllers/pig.controller';
import { ImportController } from '../controllers/import.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

router.get('/:farmId/pigs', requireFarmAccess('pigs:read'), PigController.list);
router.get('/:farmId/pigs/import/template', requireFarmAccess('import:write'), ImportController.downloadTemplate);
router.post('/:farmId/pigs/import', requireFarmAccess('import:write'), upload.single('file'), ImportController.validateUpload);
router.post('/:farmId/pigs/import/confirm', requireFarmAccess('import:write'), ImportController.confirmImport);
router.get('/:farmId/pigs/serviced-sows', requireFarmAccess('pigs:read'), PigController.getServicedSows);
router.post('/:farmId/pigs/bulk-record-sale', requireFarmAccess('pigs:write'), PigController.bulkRecordSale);
router.post('/:farmId/pigs/:pigId/vaccinations', requireFarmAccess('pigs:write'), PigController.addVaccination);
router.patch(
  '/:farmId/pigs/:pigId/vaccinations/:vaccinationId',
  requireFarmAccess('pigs:write'),
  PigController.updateVaccination,
);
router.delete(
  '/:farmId/pigs/:pigId/vaccinations/:vaccinationId',
  requireFarmAccess('pigs:write'),
  PigController.deleteVaccination,
);
router.get('/:farmId/pigs/:pigId', requireFarmAccess('pigs:read'), PigController.getById);
router.post('/:farmId/pigs', requireFarmAccess('pigs:write'), PigController.create);
router.patch('/:farmId/pigs/:pigId', requireFarmAccess('pigs:write'), PigController.update);
router.delete('/:farmId/pigs/:pigId', requireFarmAccess('pigs:delete'), PigController.delete);
router.post('/:farmId/pigs/:pigId/farrowing', requireFarmAccess('pigs:write'), PigController.addFarrowing);
router.patch(
  '/:farmId/pigs/:pigId/farrowing/:recordId',
  requireFarmAccess('pigs:write'),
  PigController.updateFarrowing,
);
router.post('/:farmId/pigs/:pigId/complete-birth', requireFarmAccess('pigs:write'), PigController.completeBirth);
router.post('/:farmId/pigs/:pigId/record-sale', requireFarmAccess('pigs:write'), PigController.recordSale);
router.post('/:farmId/pigs/:pigId/observations', requireFarmAccess('pigs:write'), PigController.addObservation);

export default router;
