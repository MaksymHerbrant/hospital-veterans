import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import {ContentApp} from './Content';
import Admin from './Admin';
import Home from './Home';
import Preloader from './Preloader';
const route=location.pathname;
createRoot(document.getElementById('root')).render(<><Preloader/>{route==='/admin' || route.startsWith('/admin/') ? <Admin/> : route==='/news' || route.startsWith('/news/') || route==='/pages' || route.startsWith('/page/') || route.startsWith('/project/') || route==='/material' || route==='/likari' || route.startsWith('/team-members/') || route.startsWith('/team-group/') ? <ContentApp/> : <Home/>}</>);
