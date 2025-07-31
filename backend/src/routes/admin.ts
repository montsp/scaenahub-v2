import { Router, Request, Response } from 'express';
import { AdminService } from '../services/admin';
import { PermissionMiddleware } from '../middleware/permissions';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const adminService = AdminService.getInstance();

// Apply authentication to all admin routes
router.use(authMiddleware);

// Dashboard Overview
router.get('/dashboard', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const overview = await adminService.getDashboardOverview();
      const alerts = await adminService.getResourceAlerts();
      
      return res.json({
        success: true,
        data: {
          ...overview,
          alerts
        }
      });
    } catch (error) {
      console.error('Dashboard overview error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load dashboard overview'
      });
    }
  }
);

// System Statistics
router.get('/stats', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const stats = await adminService.getSystemStats();
      
      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('System stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load system statistics'
      });
    }
  }
);

// Server Settings
router.get('/settings', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const settings = await adminService.getServerSettings();
      
      return res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Server settings error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load server settings'
      });
    }
  }
);

router.put('/settings', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { serverName, description, iconUrl, defaultRole, welcomeChannelId, rulesChannelId, maxMembers, inviteEnabled, publicServer } = req.body;
      
      const updatedSettings = await adminService.updateServerSettings({
        serverName,
        description,
        iconUrl,
        defaultRole,
        welcomeChannelId,
        rulesChannelId,
        maxMembers,
        inviteEnabled,
        publicServer
      });
      
      return res.json({
        success: true,
        data: updatedSettings
      });
    } catch (error) {
      console.error('Update server settings error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update server settings'
      });
    }
  }
);

// User Management
router.get('/users', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const users = await adminService.getAllUsersForManagement();
      
      return res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('User management error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load users'
      });
    }
  }
);

router.post('/users/:userId/ban', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = (req as any).user.id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
      
      await adminService.banUser(userId, reason || 'No reason provided', adminId);
      
      return res.json({
        success: true,
        message: 'User banned successfully'
      });
    } catch (error) {
      console.error('Ban user error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to ban user'
      });
    }
  }
);

router.post('/users/:userId/unban', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const adminId = (req as any).user.id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
      
      await adminService.unbanUser(userId, adminId);
      
      return res.json({
        success: true,
        message: 'User unbanned successfully'
      });
    } catch (error) {
      console.error('Unban user error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to unban user'
      });
    }
  }
);

router.post('/users/:userId/kick', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = (req as any).user.id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
      
      await adminService.kickUser(userId, reason || 'No reason provided', adminId);
      
      return res.json({
        success: true,
        message: 'User kicked successfully'
      });
    } catch (error) {
      console.error('Kick user error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to kick user'
      });
    }
  }
);

router.put('/users/:userId/roles', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { roleIds } = req.body;
      const adminId = (req as any).user.id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
      
      if (!Array.isArray(roleIds)) {
        return res.status(400).json({
          success: false,
          error: 'roleIds must be an array'
        });
      }
      
      await adminService.updateUserRoles(userId, roleIds, adminId);
      
      return res.json({
        success: true,
        message: 'User roles updated successfully'
      });
    } catch (error) {
      console.error('Update user roles error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update user roles'
      });
    }
  }
);

// Resource Monitoring
router.get('/alerts', 
  PermissionMiddleware.requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const alerts = await adminService.getResourceAlerts();
      
      return res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      console.error('Resource alerts error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load resource alerts'
      });
    }
  }
);

export default router;