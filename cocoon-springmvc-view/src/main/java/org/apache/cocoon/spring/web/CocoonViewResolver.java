package org.apache.cocoon.spring.web;

import org.springframework.web.servlet.ViewResolver;
import org.springframework.web.servlet.View;
import org.springframework.web.context.ServletContextAware;

import javax.servlet.ServletContext;
import java.util.Locale;

/**
 * A {@link ViewResolver} implementation which resolves everything to a
 * Cocoon sitemap view.
 */
public class CocoonViewResolver implements ViewResolver, ServletContextAware {

	private ServletContext servletContext;

	/**
	 * Resolve the given view by name.
	 * <p>Note: To allow for ViewResolver chaining, a ViewResolver should
	 * return <code>null</code>  if a view with the given name is not defined in it.
	 * However, this is not required: Some ViewResolvers will always attempt
	 * to build View objects with the given name, unable to return <code>null</code>
	 * (rather throwing an exception when View creation failed).
	 *
	 * @param viewName name of the view to resolve
	 * @param locale   Locale in which to resolve the view.
	 *                 ViewResolvers that support internationalization should respect this.
	 * @return the View object, or <code>null</code> if not found
	 *         (optional, to allow for ViewResolver chaining)
	 * @throws Exception if the view cannot be resolved
	 *                   (typically in case of problems creating an actual View object)
	 */
	public View resolveViewName(String viewName, Locale locale) throws Exception {
		return new CocoonView(servletContext, viewName);
	}

	/**
	 * Set the ServletContext that this object runs in.
	 * <p>Invoked after population of normal bean properties but before an init
	 * callback like InitializingBean's <code>afterPropertiesSet</code> or a
	 * custom init-method. Invoked after ApplicationContextAware's
	 * <code>setApplicationContext</code>.
	 *
	 * @param servletContext ServletContext object to be used by this object
	 * @see org.springframework.beans.factory.InitializingBean#afterPropertiesSet
	 * @see org.springframework.context.ApplicationContextAware#setApplicationContext
	 */
	public void setServletContext(ServletContext servletContext) {
		this.servletContext = servletContext;
	}
}
