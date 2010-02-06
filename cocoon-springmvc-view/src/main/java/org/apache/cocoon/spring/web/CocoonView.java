package org.apache.cocoon.spring.web;

import org.springframework.web.servlet.View;
import org.springframework.web.servlet.view.AbstractView;
import org.apache.cocoon.servlet.RequestProcessor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletRequestWrapper;
import javax.servlet.ServletContext;
import java.util.Map;

/**
 * A Spring MVC {@link View} implementation which uses a Cocoon sitemap
 * processor to render the view.
 */
public class CocoonView extends AbstractView implements View {
	private ServletContext servletContext;
	private String viewName;

	public CocoonView(ServletContext servletContext, String viewName) {
		this.servletContext = servletContext;
		this.viewName = viewName;
	}

	/**
	 * Render the merged model (static plus dynamic attributes)
	 */
	protected void renderMergedOutputModel(Map model, HttpServletRequest request, HttpServletResponse response)
			throws Exception {
		exposeModelAsRequestAttributes(model, request);
		HttpServletRequest wrappedRequest = new CocoonViewHttpServletRequest(request);
		new RequestProcessor(servletContext).service(wrappedRequest, response);
	}

	/**
	 * The content type of the view; we can't know this beforehand so return null.
	 */
	public String getContentType() {
		return null;
	}

	/**
	 * Wrapper for the main HttpServletRequest which replaces the original
	 * path info with the name of this view. 
	 */
	protected class CocoonViewHttpServletRequest extends HttpServletRequestWrapper {
		public CocoonViewHttpServletRequest(HttpServletRequest httpServletRequest) {
			super(httpServletRequest);
		}

		public String getPathInfo() {
			return (viewName.startsWith("/")) ? viewName : "/" + viewName;
		}

		public String getPathTranslated() {
			String path = super.getPathTranslated();
			return path.substring(0, path.lastIndexOf(super.getPathInfo())) + getPathInfo();
		}

		public String getRequestURI() {
			String uri = super.getRequestURI();
			return uri.substring(0, uri.lastIndexOf(super.getPathInfo())) + getPathInfo();
		}
	}
}
