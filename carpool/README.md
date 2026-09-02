# CarPool Connect 🚗

A modern, feature-rich carpooling application that connects drivers and passengers for shared rides, helping people save money, reduce their carbon footprint, and build community connections.

## 🌟 Features

### 🚗 Core Functionality
- **Trip Management**: Create, view, and manage carpool trips
- **Driver Profiles**: Comprehensive driver information with avatars and ratings
- **Passenger Booking**: Easy seat booking with real-time availability
- **Route Visualization**: Interactive maps with detailed route information
- **Real-time Search**: Filter trips by origin, destination, price, and dates

### 🎨 Enhanced User Experience
- **Modern UI**: Beautiful, responsive design with Bootstrap 5
- **Interactive Maps**: Leaflet.js integration with route visualization
- **Driver Information**: Display driver names, avatars, and ratings
- **Trip Statistics**: Distance, duration, and estimated costs
- **Mobile Responsive**: Works seamlessly on all devices

### 🔐 Security & Reliability
- **User Authentication**: Secure login and registration system
- **Data Validation**: Comprehensive input validation and error handling
- **Foreign Key Constraints**: Proper database relationships
- **Session Management**: Secure user session handling
- **Error Handling**: User-friendly error messages and fallbacks

## 🛠️ Technology Stack

### Frontend
- **EJS Template Engine**: Server-side rendering with dynamic content
- **Bootstrap 5**: Modern, responsive UI framework
- **Font Awesome**: Comprehensive icon library
- **Leaflet.js**: Interactive mapping library
- **CSS3**: Custom animations and transitions

### Backend
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **Supabase**: Backend-as-a-Service (PostgreSQL + Authentication)
- **Passport.js**: Authentication middleware
- **Nodemon**: Development server with auto-reload

### Database
- **PostgreSQL**: Primary database via Supabase
- **RLS (Row Level Security)**: Data access control
- **Foreign Key Constraints**: Data integrity
- **JSON Support**: Route data storage

### APIs & Services
- **OpenStreetMap**: Map tiles and geocoding
- **OpenRouteService**: Route calculation and optimization
- **Supabase Storage**: File uploads (avatars, images)

## 📁 Project Structure

```
CarPool/
├── 📁 public/                 # Static assets
│   ├── 📁 css/                # Stylesheets
│   │   └── 📄 trip-detail-enhanced.css
│   ├── 📁 js/                 # Client-side JavaScript
│   └── 📁 images/             # Static images
├── 📁 views/                  # EJS templates
│   ├── 📁 auth/               # Authentication pages
│   ├── 📁 partials/           # Reusable components
│   ├── 📁 profile/            # User profile pages
│   ├── 📁 trips/              # Trip-related pages
│   │   ├── 📄 list.ejs        # Trip listing page
│   │   ├── 📄 detail.ejs      # Trip detail page
│   │   └── 📄 create.ejs      # Trip creation page
│   ├── 📄 404.ejs             # Error page
│   ├── 📄 500.ejs             # Server error page
│   ├── 📄 index.ejs           # Home page
│   └── 📄 layout.ejs          # Base layout template
├── 📁 routes/                 # Express route handlers
│   └── 📄 index.js            # Main router with all routes
├── 📁 utils/                  # Utility functions
│   ├── 📄 api.js              # External API calls
│   ├── 📄 supabase.js         # Database client
│   └── 📄 validators.js       # Input validation
├── 📄 server.js               # Main server file
├── 📄 package.json            # Dependencies and scripts
├── 📄 .env                    # Environment variables
└── 📄 README.md               # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CarPool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your environment variables in `.env`:
   ```env
   # Supabase Configuration
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # OpenRouteService API (for route calculation)
   OPENROUTESERVICE_API_KEY=your_openrouteservice_key
   
   # Server Configuration
   NODE_ENV=development
   PORT=3000
   ```

4. **Database Setup**
   - Create a new project in [Supabase](https://supabase.com)
   - Run the provided SQL migration scripts
   - Set up Row Level Security (RLS) policies
   - Configure authentication providers

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
   - Register a new account or log in with existing credentials

## 📊 Database Schema

### Tables

#### **trips**
```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  origin_text TEXT NOT NULL,
  destination_text TEXT NOT NULL,
  departure_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  available_seats INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2),
  description TEXT,
  route_geojson JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **profiles**
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **bookings**
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  passenger_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed',
  booking_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(trip_id, passenger_id)
);
```

### Relationships
- **trips → profiles**: One-to-many (driver can have many trips)
- **trips → bookings**: One-to-many (trip can have many bookings)
- **profiles → bookings**: One-to-many (passenger can have many bookings)

## 🎯 Key Features in Detail

### Trip Management
- **Create Trips**: Drivers can create new trips with origin, destination, date, time, seats, and price
- **Trip Listing**: Browse available trips with advanced filtering options
- **Trip Details**: View comprehensive trip information with interactive maps
- **Route Visualization**: See routes on interactive maps with distance and duration

### Driver Information
- **Driver Profiles**: Complete driver information with avatars and bios
- **Driver Ratings**: 5-star rating system with visual indicators
- **Driver Statistics**: Trip count, on-time percentage, and overall rating
- **Verification Badges**: Verified driver status and safety features

### Booking System
- **Seat Booking**: Easy one-click booking with real-time availability
- **Booking Management**: View and manage passenger bookings
- **Availability Tracking**: Automatic seat count updates
- **Booking History**: Track past and upcoming trips

### User Experience
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Interactive Maps**: Click-to-view coordinates and route details
- **Real-time Updates**: Live seat availability and trip status
- **Error Handling**: Comprehensive error messages and fallbacks

## 🔧 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/logout` - User logout

### Trips
- `GET /trips` - List all trips with pagination and filtering
- `GET /trips/:id` - Get trip details
- `POST /trips` - Create new trip
- `POST /trips/:id/book` - Book a seat on a trip

### Profiles
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `POST /profile/avatar` - Upload profile picture

### External APIs
- **OpenRouteService**: Route calculation and optimization
- **OpenStreetMap**: Map tiles and geocoding
- **Supabase Storage**: File uploads and management

## 🎨 UI Components

### Trip Cards
- **Modern Design**: Gradient headers and shadow effects
- **Driver Information**: Avatar, name, and rating display
- **Trip Details**: Origin, destination, date, time, seats, price
- **Interactive Elements**: Hover effects and smooth transitions

### Map Features
- **Interactive Controls**: Zoom, pan, and fullscreen
- **Route Visualization**: Polylines with waypoints
- **Marker System**: Custom icons for origin, destination, and waypoints
- **Coordinate Display**: Click to view exact coordinates

### Forms
- **Validation**: Client-side and server-side validation
- **User Feedback**: Real-time validation messages
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Error Handling**: Comprehensive error display and recovery

## 🔒 Security Features

### Authentication
- **Secure Login**: Password hashing and session management
- **Social Auth**: Support for multiple authentication providers
- **Session Validation**: Automatic session cleanup and validation
- **CSRF Protection**: Cross-site request forgery prevention

### Data Protection
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Output encoding and CSP headers
- **Rate Limiting**: API request throttling

### Database Security
- **Row Level Security**: Fine-grained access control
- **Foreign Key Constraints**: Data integrity enforcement
- **Encryption**: Data encryption at rest and in transit
- **Backup Strategy**: Automated database backups

## 🚀 Deployment

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
PORT=3000
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
OPENROUTESERVICE_API_KEY=your_production_api_key
```

### Deployment Options

#### **Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### **Heroku**
```bash
# Install Heroku CLI
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=your_supabase_url
# ... other variables

# Deploy
git push heroku main
```

#### **Docker**
```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

CMD ["npm", "start"]
```

## 📈 Performance Optimization

### Database Optimization
- **Query Optimization**: Efficient joins and indexing
- **Connection Pooling**: Database connection management
- **Caching Strategy**: Redis integration for frequently accessed data
- **Pagination**: Efficient data loading with cursor-based pagination

### Frontend Optimization
- **Lazy Loading**: Images and components loaded on demand
- **Code Splitting**: Dynamic imports for better bundle sizes
- **Image Optimization**: WebP format and responsive images
- **CSS Optimization**: Minified and critical CSS inlining

### Server Optimization
- **Compression**: Gzip compression for responses
- **Static Caching**: Browser caching headers
- **CDN Integration**: Content delivery network for assets
- **Load Balancing**: Horizontal scaling support

## 🧪 Testing

### Unit Tests
```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Run API tests
npm run test:api
```

### End-to-End Tests
```bash
# Run E2E tests
npm run test:e2e

# Run with specific browser
npm run test:e2e:chrome
```

## 🐛 Troubleshooting

### Common Issues

#### **Database Connection Errors**
```bash
# Check Supabase credentials
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test database connection
npm run test:db
```

#### **Authentication Issues**
```bash
# Clear session storage
localStorage.clear()

# Check user session
npm run debug:auth
```

#### **Map Loading Issues**
```bash
# Check OpenRouteService API key
echo $OPENROUTESERVICE_API_KEY

# Test map service
npm run test:maps
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Check environment variables
npm run debug:env
```

## 📝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- **ESLint**: Follow the configured linting rules
- **Prettier**: Use consistent code formatting
- **Conventional Commits**: Use semantic commit messages
- **Documentation**: Update README and inline comments

### Pull Request Guidelines
- **Tests**: Include tests for new features
- **Documentation**: Update relevant documentation
- **Breaking Changes**: Clearly document any breaking changes
- **Performance**: Consider performance implications

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Supabase**: Backend-as-a-Service platform
- **OpenStreetMap**: Open-source mapping data
- **OpenRouteService**: Route calculation API
- **Bootstrap**: UI framework
- **Leaflet.js**: Interactive mapping library
- **Font Awesome**: Icon library

## 📞 Support

### Getting Help
- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Join community discussions
- **Email**: Contact the development team

### Community
- **Contributors**: Thank you to all contributors
- **Users**: Special thanks to our early adopters
- **Supporters**: Thanks to everyone who supports this project

---

**Built with ❤️ for the carpooling community**

*Happy carpooling! 🚗✨*
