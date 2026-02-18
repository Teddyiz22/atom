# NMH Shop - Node.js Express MVC Website

A modern web application built with Node.js, Express.js following the Model-View-Controller (MVC) pattern with EJS templating engine.

## 🚀 Features

- **MVC Architecture**: Clean separation of concerns
- **User Authentication**: Login/Register functionality with sessions
- **Responsive Design**: Built with Bootstrap 5
- **Form Validation**: Client-side and server-side validation
- **Flash Messages**: Success/error message system
- **Modern UI**: Clean and professional interface

## 📁 Project Structure

```
nmh_shop/
├── controllers/          # Business logic
│   ├── homeController.js
│   └── userController.js
├── models/              # Data models
│   └── User.js
├── routes/              # Route definitions
│   ├── homeRoutes.js
│   └── userRoutes.js
├── views/               # EJS templates
│   ├── home/
│   ├── users/
│   ├── partials/
│   └── layouts/
├── public/              # Static assets
│   ├── css/
│   └── js/
├── app.js               # Main application file
└── package.json
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nmh_shop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your configuration.

4. **Run the application**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 📦 Dependencies

- **express**: Fast, unopinionated web framework
- **ejs**: Embedded JavaScript templating engine
- **body-parser**: Parse incoming request bodies
- **cookie-parser**: Parse HTTP request cookies
- **express-session**: Session middleware
- **dotenv**: Load environment variables

## 🔧 Development Dependencies

- **nodemon**: Automatically restart the server during development

## 🎯 Usage

### Demo Credentials
- **Email**: demo@example.com
- **Password**: password123

### Available Routes

- `/` - Home page
- `/about` - About page
- `/contact` - Contact page
- `/users/login` - Login page
- `/users/register` - Registration page
- `/users/profile` - User profile (requires authentication)

## 🔒 Authentication

The application uses session-based authentication. Users can:
- Register for a new account
- Login with email and password
- Access protected routes
- Logout to end session

## 🎨 Styling

- **Bootstrap 5**: For responsive UI components
- **Bootstrap Icons**: For iconography
- **Custom CSS**: Additional styling in `public/css/style.css`

## 🚧 Future Enhancements

- Database integration (MongoDB/PostgreSQL)
- Password hashing with bcrypt
- Email verification
- Password reset functionality
- Admin panel
- Product catalog
- Shopping cart
- Payment integration

## 📝 Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-super-secret-session-key
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🔗 Links

- [Express.js Documentation](https://expressjs.com/)
- [EJS Documentation](https://ejs.co/)
- [Bootstrap 5 Documentation](https://getbootstrap.com/)

---

**Built with ❤️ using Node.js, Express & EJS** 