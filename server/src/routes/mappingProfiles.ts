import { Router } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../middleware/auth';
import { checkRole } from '../middleware/rbac'; // Import checkRole middleware
import { UserRole } from '@prisma/client'; // Import UserRole enum
import { MappingProfileService } from '../services/MappingProfileService';

const router = Router();
const mappingProfileService = new MappingProfileService();

const serviceMappingSchema = z.object({
  logicalServiceName: z.string().min(1, 'logicalServiceName is required'),
  incidentServiceId: z.string().optional(),
  incidentServiceName: z.string().optional(),
  incidentRoutingKeyOverride: z.string().optional(),
  changeRoutingKeyOverride: z.string().optional(),
  changeServiceId: z.string().optional(),
  changeServiceName: z.string().optional(),
  useIncidentForChange: z.boolean().optional(),
});

const createProfileSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  globalIncidentRoutingKey: z.string().optional(),
  serviceMappings: z.array(serviceMappingSchema).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  globalIncidentRoutingKey: z.string().optional(),
  serviceMappings: z.array(serviceMappingSchema).optional(),
});

router.use(authenticateUser);

router.get('/', checkRole([UserRole.VIEWER, UserRole.EDITOR, UserRole.ADMIN]), async (_req, res) => {
  try {
    const profiles = await mappingProfileService.getMappingProfiles();
    res.json(profiles);
  } catch (error) {
    console.error('Error listing mapping profiles:', error);
    res.status(500).json({
      message: 'Failed to list mapping profiles',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:id', checkRole([UserRole.VIEWER, UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const profile = await mappingProfileService.getMappingProfileById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Mapping profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching mapping profile:', error);
    res.status(500).json({
      message: 'Failed to fetch mapping profile',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const validation = createProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ message: 'Validation failed', errors: validation.error.issues });
    }

    const profile = await mappingProfileService.createMappingProfile(validation.data);
    res.status(201).json(profile);
  } catch (error) {
    console.error('Error creating mapping profile:', error);
    res.status(500).json({
      message: 'Failed to create mapping profile',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.put('/:id', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ message: 'Validation failed', errors: validation.error.issues });
    }

    const profile = await mappingProfileService.updateMappingProfile(
      req.params.id,
      validation.data
    );
    res.json(profile);
  } catch (error) {
    console.error('Error updating mapping profile:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ message: 'Mapping profile not found' });
    }
    res.status(500).json({
      message: 'Failed to update mapping profile',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/:id/mappings', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const mappingsSchema = z.array(serviceMappingSchema);
    const validation = mappingsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res
        .status(400)
        .json({ message: 'Validation failed', errors: validation.error.issues });
    }

    const profile = await mappingProfileService.addMappingsToProfile(
      req.params.id,
      validation.data
    );
    res.json(profile);
  } catch (error) {
    console.error('Error adding mappings to profile:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ message: 'Mapping profile not found' });
    }
    res.status(500).json({
      message: 'Failed to add mappings to profile',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.delete('/:id', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    await mappingProfileService.deleteMappingProfile(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting mapping profile:', error);
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return res.status(404).json({ message: 'Mapping profile not found' });
    }
    res.status(500).json({
      message: 'Failed to delete mapping profile',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
