import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  
  next();
};

export const handleFileUploadErrors = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof Error) {
    if (error.message.includes('File too large')) {
      res.status(413).json({
        success: false,
        error: 'File size exceeds limit'
      });
      return;
    }
    
    if (error.message.includes('not allowed')) {
      res.status(400).json({
        success: false,
        error: 'File type not allowed'
      });
      return;
    }
    
    if (error.message.includes('Too many files')) {
      res.status(400).json({
        success: false,
        error: 'Too many files uploaded'
      });
      return;
    }
  }
  
  res.status(400).json({
    success: false,
    error: 'File upload failed'
  });
};