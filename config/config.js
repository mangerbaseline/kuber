import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 4000,
  kuberApiUrl: process.env.KUBER_API_URL 
};